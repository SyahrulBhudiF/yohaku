import { Effect } from "effect"

import { ImageProcessingError } from "@/infrastructure/errors/image"

interface RemoveResponse {
  readonly id: number
  readonly type: "result" | "error"
  readonly blob?: Blob
  readonly message?: string
}

interface PendingRequest {
  readonly resolve: (blob: Blob) => void
  readonly reject: (error: ImageProcessingError) => void
}

const pending = new Map<number, PendingRequest>()
let worker: Worker | null = null
let nextId = 1

const failAll = (message: string) => {
  for (const request of pending.values()) {
    request.reject(new ImageProcessingError({ message }))
  }

  pending.clear()
  worker = null
}

const getWorker = () => {
  if (worker) {
    return worker
  }

  const instance = new Worker(new URL("./background-removal-worker.ts", import.meta.url), {
    type: "module",
  })

  instance.onmessage = (event: MessageEvent<RemoveResponse>) => {
    const response = event.data
    const request = pending.get(response.id)

    if (!request) {
      return
    }

    pending.delete(response.id)

    if (response.type === "result" && response.blob) {
      request.resolve(response.blob)

      return
    }

    request.reject(
      new ImageProcessingError({
        message: response.message ?? "Could not remove the background.",
      }),
    )
  }

  instance.onerror = (event) => {
    failAll(event.message || "Could not start the background-removal worker.")
  }

  worker = instance

  return instance
}

export const removeBackground = (file: File): Effect.Effect<Blob, ImageProcessingError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<Blob>((resolve, reject) => {
        const instance = getWorker()
        const id = nextId

        nextId += 1
        pending.set(id, { resolve, reject })
        instance.postMessage({ id, file })
      }),
    catch: (cause) =>
      cause instanceof ImageProcessingError
        ? cause
        : new ImageProcessingError({
            message: cause instanceof Error ? cause.message : "Could not start background removal.",
          }),
  })
