import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { ImagePdfWasmResult } from "@/libs/utils/image-pdf-wasm"
import type { PdfImageInput } from "./images-to-pdf"

interface PendingRequest {
  readonly resolve: (result: ImagePdfWasmResult) => void
}

type WorkerResponse =
  | { readonly id: number; readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly id: number; readonly ok: false; readonly message: string }

const pending = new Map<number, PendingRequest>()
let worker: Worker | null = null
let nextId = 1

const failAll = (message: string) => {
  for (const request of pending.values()) {
    request.resolve({ ok: false, message })
  }

  pending.clear()
  worker?.terminate()
  worker = null
}

const getWorker = () => {
  if (worker) {
    return worker
  }

  const instance = new Worker(new URL("./image-pdf-worker.ts", import.meta.url), { type: "module" })

  instance.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const request = pending.get(data.id)

    if (!request) {
      return
    }

    pending.delete(data.id)
    request.resolve(
      data.ok
        ? { ok: true, bytes: new Uint8Array(data.bytes) }
        : { ok: false, message: data.message },
    )
  }

  instance.onerror = ({ message }) => {
    failAll(message || "The image-to-PDF worker could not start.")
  }

  instance.onmessageerror = () => {
    failAll("The image-to-PDF worker returned an unreadable message.")
  }

  worker = instance

  return instance
}

export const imagesToPdfInWorker = (
  images: ReadonlyArray<PdfImageInput>,
  pageSize: ImagePdfPageSize,
): Promise<ImagePdfWasmResult> =>
  new Promise((resolve) => {
    const id = nextId
    const payload = images.map((image) => {
      const data =
        image.data.byteOffset === 0 && image.data.byteLength === image.data.buffer.byteLength
          ? image.data
          : image.data.slice()

      return { data: data.buffer as ArrayBuffer, format: image.format }
    })

    nextId += 1
    pending.set(id, { resolve })

    try {
      getWorker().postMessage(
        { id, images: payload, pageSize },
        payload.map((image) => image.data),
      )
    } catch (cause) {
      pending.delete(id)
      resolve({
        ok: false,
        message:
          cause instanceof Error ? cause.message : "Could not start the image-to-PDF worker.",
      })
    }
  })
