import type { ImageFormat } from "@/libs/schemas/image"
import type { TranscodeResponse, WorkerRequest } from "./protocol"

type Resolve = (response: TranscodeResponse) => void

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Resolve>()

const getWorker = () => {
  if (worker === null) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })

    worker.onmessage = (event: MessageEvent<TranscodeResponse>) => {
      const response = event.data

      pending.get(response.id)?.(response)
      pending.delete(response.id)
    }
  }

  return worker
}

export const transcodeInWorker = (
  bytes: Uint8Array,
  format: ImageFormat,
  quality: number,
): Promise<TranscodeResponse> =>
  new Promise((resolve) => {
    const id = nextId++
    const request: WorkerRequest = { type: "transcode", id, bytes, format, quality }

    pending.set(id, resolve)
    getWorker().postMessage(request, [bytes.buffer])
  })

/** Warm the worker's encoder for a format the user is about to convert to. */
export const preloadImageCodec = (format: ImageFormat): void => {
  if (typeof Worker === "undefined") {
    return
  }

  const request: WorkerRequest = { type: "preload", format }

  getWorker().postMessage(request)
}
