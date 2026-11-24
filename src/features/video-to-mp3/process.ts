import { Effect } from "effect"

import { VideoToMp3Error } from "@/infrastructure/errors/video"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_VIDEO_BYTES } from "@/libs/schemas/video"
import { isMediaFile } from "./validation"

export interface VideoToMp3Output {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
}

interface PendingRequest {
  readonly resolve: (bytes: ArrayBuffer) => void
  readonly reject: (code: WorkerErrorCode) => void
  readonly onProgress: (progress: number) => void
}

type WorkerErrorCode = "no-audio" | "unsupported" | "memory" | "processing" | "worker"

type WorkerResponse =
  | { readonly id: number; readonly type: "progress"; readonly progress: number }
  | { readonly id: number; readonly type: "result"; readonly bytes: ArrayBuffer }
  | {
      readonly id: number
      readonly type: "error"
      readonly code: Exclude<WorkerErrorCode, "worker">
    }

const pending = new Map<number, PendingRequest>()
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

  const instance = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })

  instance.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
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

  instance.onerror = () => failAll()
  worker = instance

  return instance
}

const convertInWorker = (file: File, onProgress: (progress: number) => void) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const id = nextId

    nextId += 1
    pending.set(id, { resolve, reject, onProgress })
    getWorker().postMessage({ id, file })
  })

const errorMessage = (code: WorkerErrorCode) => {
  switch (code) {
    case "no-audio":
      return "This file has no audio track to convert."
    case "unsupported":
      return "This file uses an audio codec your browser cannot decode. Try an MP4 or WebM video with AAC or Opus audio."
    case "memory":
      return "This video is too large to convert with the memory available in your browser. Try a shorter video."
    case "processing":
      return "The video could not be converted. Check that the file is valid and try another video."
    case "worker":
      return "The audio conversion worker stopped unexpectedly. Try again with the same file."
  }
}

export const convertVideoToMp3 = (
  file: File,
  onProgress: (progress: number) => void,
): Promise<VideoToMp3Output> =>
  runEffect(
    Effect.gen(function* () {
      if (!isMediaFile(file)) {
        return yield* new VideoToMp3Error({ message: "Choose a video or audio file." })
      }

      if (file.size === 0 || file.size > MAX_VIDEO_BYTES) {
        return yield* new VideoToMp3Error({
          message:
            file.size === 0
              ? "This media file is empty."
              : `Video and audio files can be at most ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`,
        })
      }

      const bytes = yield* Effect.tryPromise({
        try: () => convertInWorker(file, onProgress),
        catch: (cause) =>
          new VideoToMp3Error({
            message: errorMessage(
              typeof cause === "string" &&
                ["no-audio", "unsupported", "memory", "processing", "worker"].includes(cause)
                ? (cause as WorkerErrorCode)
                : "processing",
            ),
          }),
      })
      const blob = new Blob([bytes], { type: "audio/mpeg" })
      const fileName = file.name.replace(/\.[^.]+$/, "") || "audio"

      return {
        blob,
        fileName: `${fileName}.mp3`,
        inputBytes: file.size,
        outputBytes: blob.size,
      }
    }),
  )
