import type { ImageFormat } from "@/libs/schemas/image"
import type {
  EncodeRequest,
  EncodeResponse,
  TranscodeRequest,
  TranscodeResponse,
  WorkerRequest,
  WorkerResponse,
} from "./protocol"

type Resolve = (response: WorkerResponse) => void
type Reject = (error: Error) => void
type JobRequest = TranscodeRequest | EncodeRequest

interface WorkerSlot {
  readonly worker: Worker
  active: number
}

interface PendingRequest {
  readonly resolve: Resolve
  readonly reject: Reject
  readonly slot: WorkerSlot
}

let nextId = 1
const pending = new Map<number, PendingRequest>()
const slots: Array<WorkerSlot> = []
const preloaded = new Set<ImageFormat>()

const maxWorkers = () => {
  if (typeof navigator === "undefined") {
    return 1
  }

  return Math.max(1, Math.min(4, navigator.hardwareConcurrency ?? 2))
}

/** Number of codec workers used for batch encoding. */
export const imageWorkerLimit = (): number => maxWorkers()

const failSlot = (slot: WorkerSlot, message: string) => {
  const index = slots.indexOf(slot)

  if (index >= 0) {
    slots.splice(index, 1)
  }

  slot.worker.terminate()

  for (const [id, request] of pending) {
    if (request.slot !== slot) {
      continue
    }

    pending.delete(id)
    slot.active = Math.max(0, slot.active - 1)
    request.reject(new Error(message))
  }
}

const createSlot = (): WorkerSlot => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
  const slot: WorkerSlot = { worker, active: 0 }

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const request = pending.get(response.id)

    if (!request) {
      return
    }

    pending.delete(response.id)
    request.slot.active = Math.max(0, request.slot.active - 1)
    request.resolve(response)
  }

  worker.onerror = ({ message }) => {
    failSlot(slot, message || "The image codec worker could not start.")
  }

  worker.onmessageerror = () => {
    failSlot(slot, "The image codec worker returned an unreadable message.")
  }

  slots.push(slot)

  for (const format of preloaded) {
    worker.postMessage({ type: "preload", format } satisfies WorkerRequest)
  }

  return slot
}

const acquireSlot = (): WorkerSlot => {
  const idle = slots.find((slot) => slot.active === 0)

  if (idle) {
    return idle
  }

  if (slots.length < maxWorkers()) {
    return createSlot()
  }

  return slots.reduce((least, slot) => (slot.active < least.active ? slot : least), slots[0]!)
}

const post = (request: JobRequest, transfer: Transferable[], resolve: Resolve, reject: Reject) => {
  const slot = acquireSlot()

  slot.active++
  pending.set(request.id, { resolve, reject, slot })

  try {
    slot.worker.postMessage(request, transfer)
  } catch (cause) {
    pending.delete(request.id)
    slot.active = Math.max(0, slot.active - 1)
    reject(cause instanceof Error ? cause : new Error("Could not reach the image codec worker."))
  }
}

export const transcodeInWorker = (
  bytes: Uint8Array,
  format: ImageFormat,
  quality: number,
): Promise<TranscodeResponse> =>
  new Promise((resolve, reject) => {
    const id = nextId
    const request: JobRequest = { type: "transcode", id, bytes, format, quality }

    post(
      request,
      [bytes.buffer],
      (response) => {
        if (response.type === "transcode") {
          resolve(response)
        } else {
          reject(new Error("The image codec worker returned an unexpected response."))
        }
      },
      reject,
    )
  })

export const encodeInWorker = (
  image: ImageData,
  format: ImageFormat,
  quality: number,
): Promise<EncodeResponse> =>
  new Promise((resolve, reject) => {
    const id = nextId
    // Transfer the caller's buffer when possible. The worker owns the pixels
    // after this call, so callers must not reuse the ImageData.
    const source = image.data
    const data =
      source.buffer instanceof ArrayBuffer
        ? (source as Uint8ClampedArray<ArrayBuffer>)
        : new Uint8ClampedArray(source)
    const request: JobRequest = {
      type: "encode",
      id,
      data,
      width: image.width,
      height: image.height,
      format,
      quality,
    }

    post(
      request,
      [data.buffer],
      (response) => {
        if (response.type === "encode") {
          resolve(response)
        } else {
          reject(new Error("The image codec worker returned an unexpected response."))
        }
      },
      reject,
    )
  })

/** Warm the worker's encoder for a format the user is about to convert to. */
export const preloadImageCodec = (format: ImageFormat): void => {
  if (typeof Worker === "undefined") {
    return
  }

  preloaded.add(format)

  if (slots.length === 0) {
    createSlot()
  }

  for (const slot of slots) {
    slot.worker.postMessage({ type: "preload", format } satisfies WorkerRequest)
  }
}
