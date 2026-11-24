import type { ExcelOrientation, ExcelPageSize } from "@/libs/schemas/excel"

interface PendingRequest {
  readonly resolve: (bytes: ArrayBuffer) => void
  readonly reject: (message: string) => void
}

type WorkerResponse =
  | { readonly type: "ready" }
  | {
      readonly type: "result"
      readonly id: number
      readonly ok: true
      readonly bytes: ArrayBuffer
    }
  | {
      readonly type: "result"
      readonly id: number
      readonly ok: false
      readonly message: string
    }

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

export const getXlsxPdfWorker = () => {
  if (worker) {
    return worker
  }

  const instance = new Worker(new URL("./xlsx-pdf-worker.ts", import.meta.url), {
    type: "module",
  })

  instance.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    if (data.type === "ready") {
      return
    }

    const request = pending.get(data.id)

    if (!request) {
      return
    }

    pending.delete(data.id)

    if (data.ok) {
      request.resolve(data.bytes)
    } else {
      request.reject(data.message)
    }
  }

  instance.onerror = ({ message }) => {
    failAll(message || "The Excel-to-PDF worker could not start.")
  }

  instance.onmessageerror = () => {
    failAll("The Excel-to-PDF worker returned an unreadable message.")
  }

  worker = instance

  return instance
}

export const convertXlsxInWorker = (
  bytes: Uint8Array,
  pageSize: ExcelPageSize,
  orientation: ExcelOrientation,
): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const id = nextId
    const data =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? (bytes as Uint8Array<ArrayBuffer>)
        : bytes.slice()

    nextId += 1
    pending.set(id, { resolve, reject })

    try {
      getXlsxPdfWorker().postMessage(
        { type: "convert", id, bytes: data.buffer, pageSize, orientation },
        [data.buffer],
      )
    } catch (cause) {
      pending.delete(id)
      reject(cause instanceof Error ? cause.message : "Could not start the Excel converter.")
    }
  })
