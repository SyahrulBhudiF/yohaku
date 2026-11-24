import type {
  PdfQpdf,
  QpdfWorkerMethod,
  QpdfWorkerRequest,
  QpdfWorkerResponse,
} from "./qpdf-worker-protocol"

interface PendingRequest {
  readonly resolve: (result: unknown) => void
  readonly reject: (cause: unknown) => void
  readonly onProgress?: (percent: number) => void
}

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

const serializableOptions = <
  T extends { readonly onProgress?: (percent: number) => void } | undefined,
>(
  options: T,
): Omit<T, "onProgress"> | undefined => {
  if (options === undefined) return undefined

  const copy: Record<string, unknown> = { ...options }

  delete copy["onProgress"]

  return copy as Omit<T, "onProgress">
}

const serializeInputs = (value: unknown): unknown => {
  if (
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeInputs(item))
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value)
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeInputs(item)]),
    )
  }

  return value
}

export const createQpdfWorkerClient = (): PdfQpdf => {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, PendingRequest>()

  const failAll = (cause: unknown) => {
    for (const request of pending.values()) request.reject(cause)

    pending.clear()
    worker?.terminate()
    worker = null
  }

  const getWorker = () => {
    if (worker) return worker

    const instance = new Worker(new URL("./qpdf-worker.ts", import.meta.url), { type: "module" })

    instance.onmessage = ({ data }: MessageEvent<QpdfWorkerResponse>) => {
      const request = pending.get(data.id)

      if (!request) return

      if (data.type === "progress") {
        request.onProgress?.(data.percent)

        return
      }

      pending.delete(data.id)

      if (data.type === "result") {
        request.resolve(data.result)
      } else {
        request.reject({ message: data.message, code: data.code })
      }
    }

    instance.onerror = (event) => {
      failAll({ message: event.message || "The PDF processing worker could not start." })
    }

    instance.onmessageerror = () => {
      failAll({ message: "The PDF processing worker returned unreadable data." })
    }

    worker = instance

    return instance
  }

  const call = async <Method extends QpdfWorkerMethod>(
    method: Method,
    args: ReadonlyArray<unknown>,
    onProgress?: (percent: number) => void,
  ): Promise<unknown> => {
    const id = nextId++
    const result = new Promise<unknown>((resolve, reject) => {
      pending.set(id, {
        resolve,
        reject,
        ...(onProgress === undefined ? {} : { onProgress }),
      })
    })

    try {
      const instance = getWorker()
      const serializedArgs = serializeInputs(args) as ReadonlyArray<unknown>

      if (pending.has(id)) {
        const request: QpdfWorkerRequest = {
          type: "run",
          id,
          method,
          args: serializedArgs,
          reportProgress: onProgress !== undefined,
        }

        instance.postMessage(request, [...collectTransferables(serializedArgs)])
      }
    } catch (cause) {
      const request = pending.get(id)

      pending.delete(id)
      request?.reject(cause)

      return result
    }

    return result
  }

  return {
    compress: (input, options) =>
      call("compress", [input, serializableOptions(options)], options?.onProgress) as ReturnType<
        PdfQpdf["compress"]
      >,
    decrypt: (input, options) =>
      call("decrypt", [input, serializableOptions(options)], options.onProgress) as ReturnType<
        PdfQpdf["decrypt"]
      >,
    encrypt: (input, options) =>
      call("encrypt", [input, serializableOptions(options)], options.onProgress) as ReturnType<
        PdfQpdf["encrypt"]
      >,
    info: (input, options) => call("info", [input, options]) as ReturnType<PdfQpdf["info"]>,
    rotate: (input, rotations, options) =>
      call(
        "rotate",
        [input, rotations, serializableOptions(options)],
        options?.onProgress,
      ) as ReturnType<PdfQpdf["rotate"]>,
    run: (args, options) =>
      call("run", [args, serializableOptions(options)], options?.onProgress) as ReturnType<
        PdfQpdf["run"]
      >,
    selectPages: (input, ranges, options) =>
      call(
        "selectPages",
        [input, ranges, serializableOptions(options)],
        options?.onProgress,
      ) as ReturnType<PdfQpdf["selectPages"]>,
    split: (input, options) =>
      call("split", [input, serializableOptions(options)], options?.onProgress) as ReturnType<
        PdfQpdf["split"]
      >,
  }
}
