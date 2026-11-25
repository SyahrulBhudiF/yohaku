import type { PdfAnnotateLogo, PdfAnnotateOptions } from "./types"

interface PendingRequest {
  readonly resolve: (bytes: ArrayBuffer) => void
  readonly reject: (message: string) => void
}

type WorkerResponse =
  | { readonly id: number; readonly type: "result"; readonly bytes: ArrayBuffer }
  | { readonly id: number; readonly type: "error"; readonly message: string }

const pending = new Map<number, PendingRequest>()
let worker: Worker | null = null
let nextId = 1

const failAll = (message: string) => {
  for (const request of pending.values()) {
    request.reject(message)
  }

  pending.clear()
  worker?.terminate()
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

    if (data.type === "result") {
      request.resolve(data.bytes)
    } else {
      request.reject(data.message)
    }
  }

  instance.onerror = ({ message }) => {
    failAll(message || "The PDF annotation worker could not start.")
  }

  instance.onmessageerror = () => {
    failAll("The PDF annotation worker returned an unreadable message.")
  }

  worker = instance

  return instance
}

const transferable = (bytes: Uint8Array) =>
  bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? (bytes as Uint8Array<ArrayBuffer>)
    : bytes.slice()

export const annotatePdfInWorker = (
  bytes: Uint8Array,
  options: PdfAnnotateOptions,
  logo?: { readonly bytes: Uint8Array; readonly kind: "png" | "jpeg" },
): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const id = nextId
    const source = transferable(bytes)
    const image = logo ? transferable(logo.bytes) : null
    const imageMessage: PdfAnnotateLogo | undefined =
      image && logo ? { bytes: image.buffer, kind: logo.kind } : undefined

    nextId += 1
    pending.set(id, { resolve, reject })

    try {
      const transfer = [source.buffer]

      if (image) {
        transfer.push(image.buffer)
      }

      getWorker().postMessage({ id, bytes: source.buffer, options, logo: imageMessage }, transfer)
    } catch (cause) {
      pending.delete(id)
      reject(cause instanceof Error ? cause.message : "Could not start the PDF annotation worker.")
    }
  })
