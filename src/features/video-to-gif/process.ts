import { Effect, Schema } from "effect"

import { VideoToGifError } from "@/infrastructure/errors/video"
import { runEffect } from "@/infrastructure/runtime"
import {
  MAX_VIDEO_GIF_FRAMES,
  MAX_VIDEO_GIF_INPUT_BYTES,
  MAX_VIDEO_GIF_OUTPUT_BYTES,
  MAX_VIDEO_GIF_SECONDS,
  type VideoGifFormValues,
  type VideoToGifOutput,
  VideoGifFormSchema,
  VideoToGifOutputSchema,
} from "@/libs/schemas/video-gif"
import { isAnimatedGif } from "./gif-validation"
import { isVideoFile } from "./validation"

type WorkerErrorCode =
  | "unsupported"
  | "duration"
  | "too-many-frames"
  | "memory"
  | "invalid-output"
  | "processing"
  | "worker"

interface PendingRequest {
  readonly resolve: (bytes: ArrayBuffer) => void
  readonly reject: (code: WorkerErrorCode) => void
  readonly onProgress: (progress: number) => void
}

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
  for (const request of pending.values()) request.reject("worker")

  pending.clear()
  worker?.terminate()
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

  instance.onerror = failAll
  instance.onmessageerror = failAll
  worker = instance

  return instance
}

const convertInWorker = (
  file: File,
  options: VideoGifFormValues,
  onProgress: (progress: number) => void,
) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const id = nextId

    nextId += 1
    pending.set(id, { resolve, reject, onProgress })
    getWorker().postMessage({ id, file, options })
  })

const errorMessage = (code: WorkerErrorCode) => {
  switch (code) {
    case "unsupported":
      return "This video format or codec cannot be decoded by your browser. Try an MP4 or WebM video."
    case "duration":
      return "The selected range is outside the video. Choose a start time before the video ends."
    case "too-many-frames":
      return `Choose a shorter clip or lower the frame rate; GIFs are limited to ${MAX_VIDEO_GIF_FRAMES} frames.`
    case "memory":
      return "This GIF would use too much memory. Try a shorter clip or a smaller output width."
    case "invalid-output":
      return "The browser could not create a valid animated GIF from this video."
    case "processing":
      return "The video could not be converted. Check that it is valid and try another clip."
    case "worker":
      return "The conversion worker stopped unexpectedly. Try again with the same video."
  }
}

export const convertVideoToGif = (
  file: File,
  options: unknown,
  onProgress: (progress: number) => void,
): Promise<VideoToGifOutput> =>
  runEffect(
    Effect.gen(function* () {
      const values = yield* Effect.mapError(
        Schema.decodeUnknownEffect(VideoGifFormSchema)(options),
        () => new VideoToGifError({ message: "Choose valid trim and GIF settings." }),
      )

      if (!isVideoFile(file)) {
        return yield* new VideoToGifError({ message: "Choose a video file." })
      }

      if (file.size === 0 || file.size > MAX_VIDEO_GIF_INPUT_BYTES) {
        return yield* new VideoToGifError({
          message:
            file.size === 0
              ? "This video file is empty."
              : `Video files can be at most ${MAX_VIDEO_GIF_INPUT_BYTES / 1024 / 1024} MB.`,
        })
      }

      const clipDuration = values.endSeconds - values.startSeconds

      if (
        clipDuration <= 0 ||
        clipDuration > MAX_VIDEO_GIF_SECONDS ||
        Math.ceil(clipDuration * values.fps) > MAX_VIDEO_GIF_FRAMES
      ) {
        return yield* new VideoToGifError({
          message: `Choose an end time after the start time, within a ${MAX_VIDEO_GIF_SECONDS}-second clip and ${MAX_VIDEO_GIF_FRAMES} frames.`,
        })
      }

      const bytes = yield* Effect.tryPromise({
        try: () => convertInWorker(file, values, onProgress),
        catch: (cause) =>
          new VideoToGifError({
            message: errorMessage(
              typeof cause === "string" &&
                [
                  "unsupported",
                  "duration",
                  "too-many-frames",
                  "memory",
                  "invalid-output",
                  "processing",
                  "worker",
                ].includes(cause)
                ? (cause as WorkerErrorCode)
                : "processing",
            ),
          }),
      })

      if (
        bytes.byteLength === 0 ||
        bytes.byteLength > MAX_VIDEO_GIF_OUTPUT_BYTES ||
        !isAnimatedGif(new Uint8Array(bytes))
      ) {
        return yield* new VideoToGifError({
          message: "The conversion did not produce a valid animated GIF.",
        })
      }

      const blob = new Blob([bytes], { type: "image/gif" })
      const baseName = file.name.replace(/\.[^.]+$/, "") || "video"

      return yield* Schema.decodeEffect(VideoToGifOutputSchema)({
        blob,
        fileName: `${baseName}.gif`,
        inputBytes: file.size,
        outputBytes: blob.size,
      }).pipe(
        Effect.mapError(() => new VideoToGifError({ message: "Could not create the GIF output." })),
      )
    }),
  )
