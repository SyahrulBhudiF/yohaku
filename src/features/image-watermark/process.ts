import { Effect, Result } from "effect"

import { FileTooLargeError, ImageProcessingError } from "@/infrastructure/errors/image"
import { runEffect } from "@/infrastructure/runtime"
import {
  MAX_WATERMARK_BYTES,
  MAX_WATERMARK_LOGO_BYTES,
  MAX_WATERMARK_PIXELS,
  WATERMARK_FORMAT_EXTENSION,
  WATERMARK_FORMAT_MIME,
  type WatermarkFormValues,
  type WatermarkOutput,
} from "@/libs/schemas/watermark"
import { detectImageInputFormat } from "@/libs/utils/image-codec"
import { readImageSize } from "@/libs/utils/image-decode"

type WorkerErrorCode = "read" | "logo" | "encode" | "canvas" | "worker"

interface WorkerResult {
  readonly data: Uint8Array<ArrayBuffer>
  readonly width: number
  readonly height: number
}

const WORKER_ERROR: Record<WorkerErrorCode, string> = {
  read: "Could not read this image.",
  logo: "Could not read the logo image.",
  encode: "Could not encode the watermarked image.",
  canvas: "This browser cannot draw the watermark.",
  worker: "The watermark worker could not start.",
}

const watermarkInWorker = (
  image: ArrayBuffer,
  logo: ArrayBuffer | undefined,
  options: WatermarkFormValues,
): Promise<WorkerResult> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
    const id = Date.now()
    let settled = false

    const fail = (code: WorkerErrorCode) => {
      if (settled) return

      settled = true
      worker.terminate()
      reject(new ImageProcessingError({ message: WORKER_ERROR[code] }))
    }

    worker.onmessage = ({
      data,
    }: MessageEvent<{
      id: number
      ok: boolean
      data?: ArrayBuffer
      width?: number
      height?: number
      code?: WorkerErrorCode
    }>) => {
      if (data.id !== id || settled) return

      settled = true
      worker.terminate()

      if (data.ok && data.data && data.width && data.height) {
        resolve({ data: new Uint8Array(data.data), width: data.width, height: data.height })
      } else {
        reject(new ImageProcessingError({ message: WORKER_ERROR[data.code ?? "worker"] }))
      }
    }

    worker.onerror = () => fail("worker")
    worker.onmessageerror = () => fail("worker")
    worker.postMessage({ id, image, logo, options }, logo ? [image, logo] : [image])
  })

export interface WatermarkImageInput {
  readonly file: File
  readonly logo: File | null
  readonly options: WatermarkFormValues
}

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "image"

const program = (input: WatermarkImageInput) =>
  Effect.gen(function* () {
    if (input.file.size > MAX_WATERMARK_BYTES) {
      return yield* new FileTooLargeError({
        message: `Images can be at most ${MAX_WATERMARK_BYTES / 1024 / 1024} MB.`,
        maxBytes: MAX_WATERMARK_BYTES,
      })
    }

    if (input.logo && input.logo.size > MAX_WATERMARK_LOGO_BYTES) {
      return yield* new ImageProcessingError({
        message: `Logos can be at most ${MAX_WATERMARK_LOGO_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (input.options.type === "text" && !input.options.text.trim()) {
      return yield* new ImageProcessingError({ message: "Enter watermark text." })
    }

    if (input.options.type === "logo" && !input.logo) {
      return yield* new ImageProcessingError({ message: "Choose a logo image." })
    }

    const image = yield* Effect.tryPromise({
      try: () => input.file.arrayBuffer(),
      catch: () => new ImageProcessingError({ message: "Could not read this image." }),
    })
    const imageFormat = detectImageInputFormat(new Uint8Array(image))

    if (imageFormat !== "png" && imageFormat !== "jpeg" && imageFormat !== "webp") {
      return yield* new ImageProcessingError({ message: "Use a PNG, JPEG, or WebP image." })
    }

    const measured = yield* Effect.tryPromise({
      try: () => readImageSize(input.file),
      catch: () => null,
    }).pipe(Effect.result)

    if (
      Result.isSuccess(measured) &&
      measured.success !== null &&
      measured.success.width * measured.success.height > MAX_WATERMARK_PIXELS
    ) {
      return yield* new ImageProcessingError({
        message: `Use an image under ${MAX_WATERMARK_PIXELS / 1_000_000} megapixels.`,
      })
    }

    let logo: ArrayBuffer | undefined

    if (input.logo) {
      logo = yield* Effect.tryPromise({
        try: () => input.logo!.arrayBuffer(),
        catch: () => new ImageProcessingError({ message: "Could not read the logo image." }),
      })

      const logoFormat = detectImageInputFormat(new Uint8Array(logo))

      if (logoFormat !== "png" && logoFormat !== "jpeg" && logoFormat !== "webp") {
        return yield* new ImageProcessingError({ message: "Use a PNG, JPEG, or WebP logo." })
      }
    }

    const output = yield* Effect.tryPromise({
      try: () => watermarkInWorker(image, logo, input.options),
      catch: (cause) =>
        cause instanceof ImageProcessingError
          ? cause
          : new ImageProcessingError({ message: WORKER_ERROR.worker }),
    })
    const mimeType = WATERMARK_FORMAT_MIME[input.options.format]

    return {
      blob: new Blob([output.data], { type: mimeType }),
      fileName: `${fileBaseName(input.file.name)}-watermarked.${WATERMARK_FORMAT_EXTENSION[input.options.format]}`,
      mimeType,
      inputBytes: input.file.size,
      bytes: output.data.byteLength,
      width: output.width,
      height: output.height,
    } satisfies WatermarkOutput
  })

export const watermarkImage = (input: WatermarkImageInput): Promise<WatermarkOutput> =>
  runEffect(program(input))
