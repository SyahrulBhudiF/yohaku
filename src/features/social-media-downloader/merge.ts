export type MergeContainer = "mp4" | "webm"

export type MergeErrorCode = "unsupported" | "too-large" | "processing" | "worker"

export interface MergeRequest {
  readonly id: number
  readonly video: Blob
  readonly audio: Blob
  readonly container: MergeContainer
}

export type MergeResponse =
  | { readonly id: number; readonly type: "progress"; readonly progress: number }
  | { readonly id: number; readonly type: "result"; readonly bytes: ArrayBuffer }
  | {
      readonly id: number
      readonly type: "error"
      readonly code: Exclude<MergeErrorCode, "worker">
    }

interface PendingMerge {
  readonly resolve: (bytes: ArrayBuffer) => void
  readonly reject: (code: MergeErrorCode) => void
  readonly onProgress: (progress: number) => void
}

const pending = new Map<number, PendingMerge>()
let worker: Worker | null = null
let nextId = 1

const failAll = () => {
  for (const request of pending.values()) {
    request.reject("worker")
  }

  pending.clear()
  worker = null
}

const getWorker = () => {
  if (worker) return worker

  const instance = new Worker(new URL("./merge-worker.ts", import.meta.url), { type: "module" })

  instance.onmessage = ({ data }: MessageEvent<MergeResponse>) => {
    const request = pending.get(data.id)

    if (!request) return

    if (data.type === "progress") {
      request.onProgress(data.progress)

      return
    }

    pending.delete(data.id)

    if (data.type === "result") {
      request.resolve(data.bytes)
    } else {
      request.reject(data.code)
    }
  }

  instance.onerror = failAll
  instance.onmessageerror = failAll
  worker = instance

  return instance
}

export const mergeInWorker = (
  video: Blob,
  audio: Blob,
  container: MergeContainer,
  onProgress: (progress: number) => void,
) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const id = nextId

    nextId += 1
    pending.set(id, { resolve, reject, onProgress })
    getWorker().postMessage({ id, video, audio, container } satisfies MergeRequest)
  })
