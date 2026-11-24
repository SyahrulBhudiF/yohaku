import { createQpdf, type Qpdf } from "@mssio/qpdf-wasm"

import type {
  QpdfWorkerMethod,
  QpdfWorkerRequest,
  QpdfWorkerResponse,
} from "./qpdf-worker-protocol"

interface WorkerScope {
  onmessage: ((event: MessageEvent<QpdfWorkerRequest>) => void) | null
  postMessage: (message: QpdfWorkerResponse, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope
let engine: Promise<Qpdf> | undefined
let queue = Promise.resolve()

const optionsArgument = (method: QpdfWorkerMethod) =>
  method === "selectPages" || method === "rotate" ? 2 : 1

const collectTransferables = (
  value: unknown,
  buffers = new Set<ArrayBuffer>(),
): Set<ArrayBuffer> => {
  if (value instanceof ArrayBuffer) {
    buffers.add(value)
  } else if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) {
    buffers.add(value.buffer)
  } else if (Array.isArray(value)) {
    for (const item of value) collectTransferables(item, buffers)
  } else if (typeof Blob !== "undefined" && value instanceof Blob) {
    return buffers
  } else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) collectTransferables(item, buffers)
  }

  return buffers
}

const serializeFailure = (cause: unknown) => {
  if (typeof cause === "object" && cause !== null) {
    const message =
      cause instanceof Error
        ? cause.message
        : "message" in cause
          ? String(cause.message)
          : "Unknown qpdf failure"
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : undefined

    return code === undefined ? { message } : { message, code }
  }

  return { message: String(cause) }
}

const loadEngine = () => {
  if (!engine) {
    engine = createQpdf({ inline: true }).catch((cause: unknown) => {
      engine = undefined

      throw cause
    })
  }

  return engine
}

const runRequest = async (request: QpdfWorkerRequest) => {
  try {
    const qpdf = await loadEngine()
    const args = [...request.args]

    if (request.reportProgress && request.method !== "info") {
      const index = optionsArgument(request.method)
      const options = (args[index] ?? {}) as Record<string, unknown>

      args[index] = {
        ...options,
        onProgress: (percent: number) => {
          scope.postMessage({ id: request.id, type: "progress", percent })
        },
      }
    }

    const method = qpdf[request.method] as (...args: ReadonlyArray<unknown>) => Promise<unknown>
    const result = await method(...args)

    if (request.method === "encrypt" || request.method === "decrypt") {
      const { output, warnings } = result as {
        output: Uint8Array<ArrayBuffer>
        warnings: Array<string>
      }
      const blob = new Blob([output], { type: "application/pdf" })

      scope.postMessage({
        id: request.id,
        type: "result",
        result: {
          output: { url: URL.createObjectURL(blob), size: blob.size },
          warnings,
        },
      })

      return
    }

    const transfer = [...collectTransferables(result)]

    scope.postMessage({ id: request.id, type: "result", result }, transfer)
  } catch (cause) {
    scope.postMessage({ id: request.id, type: "error", ...serializeFailure(cause) })
  }
}

scope.onmessage = ({ data }: MessageEvent<QpdfWorkerRequest>) => {
  queue = queue.then(() => runRequest(data))
}
