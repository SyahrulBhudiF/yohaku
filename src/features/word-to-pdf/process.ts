import { Effect } from "effect"

import { WordToPdfError } from "@/infrastructure/errors/document-conversion"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_DOCX_BYTES } from "@/libs/schemas/document"

export interface WordToPdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
}

interface WorkerResponse {
  readonly id: number
  readonly type: "result" | "error"
  readonly bytes?: ArrayBuffer
  readonly message?: string
}

interface PendingRequest {
  readonly resolve: (bytes: ArrayBuffer) => void
  readonly reject: (message: string) => void
}

const pending = new Map<number, PendingRequest>()
let worker: Worker | null = null
let nextId = 1

const failAll = (message: string) => {
  for (const request of pending.values()) {
    request.reject(message)
  }

  pending.clear()
  worker = null
}

const getWorker = () => {
  if (worker) {
    return worker
  }

  const instance = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })

  instance.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const request = pending.get(data.id)

    if (!request) {
      return
    }

    pending.delete(data.id)

    if (data.type === "result" && data.bytes) {
      request.resolve(data.bytes)
    } else {
      request.reject(data.message ?? "The Word-to-PDF worker could not convert this file.")
    }
  }

  instance.onerror = ({ message }) => {
    failAll(message || "The Word-to-PDF worker could not start.")
  }

  worker = instance

  return instance
}

const convertInWorker = async (file: File) => {
  const buffer = await file.arrayBuffer()

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const id = nextId

    nextId += 1
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, bytes: buffer }, [buffer])
  })
}

export const convertWordToPdf = (file: File): Promise<WordToPdfOutput> =>
  runEffect(
    Effect.gen(function* () {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        return yield* new WordToPdfError({ message: "Choose a .docx Word document." })
      }

      if (file.size === 0 || file.size > MAX_DOCX_BYTES) {
        return yield* new WordToPdfError({
          message:
            file.size === 0
              ? "This Word document is empty."
              : `Word documents can be at most ${MAX_DOCX_BYTES / 1024 / 1024} MB.`,
        })
      }

      const bytes = yield* Effect.tryPromise({
        try: () => convertInWorker(file),
        catch: (cause) =>
          new WordToPdfError({
            message:
              cause instanceof Error
                ? `Could not convert this Word document: ${cause.message}`
                : `Could not convert this Word document: ${String(cause)}`,
          }),
      })
      const blob = new Blob([bytes], { type: "application/pdf" })

      return {
        blob,
        fileName: `${file.name.replace(/\.docx$/i, "") || "document"}.pdf`,
        inputBytes: file.size,
        outputBytes: blob.size,
      }
    }),
  )
