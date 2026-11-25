import { Effect } from "effect"

import { FileTooLargeError, ImageProcessingError } from "@/infrastructure/errors/image"
import { runEffect } from "@/infrastructure/runtime"
import { ImageProcessor } from "@/infrastructure/services/image-processor"
import {
  IMAGE_EXTENSION,
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  type ImageFormat,
  type ImageResizeFormat,
} from "@/libs/schemas/image"
import { decodeImage, detectImageFormat, preloadImageCodec } from "@/libs/utils/image-codec"
import { readImageSize } from "@/libs/utils/image-decode"
import type { ResizeOptions } from "@/libs/utils/image-resize"

export interface ResizeFileInfo {
  readonly file: File
  readonly width: number
  readonly height: number
  readonly format: ImageFormat
}

export type PrepareResizeFileResult =
  | { readonly ok: true; readonly info: ResizeFileInfo }
  | { readonly ok: false; readonly message: string }

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "image"

/** Reads dimensions and the source format before the resize form is shown. */
export const prepareResizeFile = async (file: File): Promise<PrepareResizeFileResult> => {
  if (file.size === 0) {
    return { ok: false, message: "This image is empty." }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    }
  }

  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const format = detectImageFormat(header)

  if (format === null) {
    return { ok: false, message: "Choose a readable PNG, JPEG, WebP, AVIF, GIF, or TIFF." }
  }

  let size: { readonly width: number; readonly height: number }

  try {
    size = await readImageSize(file)
  } catch {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const image = await decodeImage(bytes, format)

    if (!image) {
      return { ok: false, message: "Could not read this image." }
    }

    size = { width: image.width, height: image.height }
  }

  if (size.width * size.height > MAX_IMAGE_PIXELS) {
    return {
      ok: false,
      message: `Use an image under ${MAX_IMAGE_PIXELS / 1_000_000} megapixels.`,
    }
  }

  return { ok: true, info: { file, width: size.width, height: size.height, format } }
}

export interface ResizeImageInput {
  readonly file: File
  readonly options: ResizeOptions
  readonly format: ImageResizeFormat
  readonly quality: number
}

export interface ResizeImageOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly mimeType: string
  readonly inputBytes: number
  readonly bytes: number
  readonly width: number
  readonly height: number
}

const program = (input: ResizeImageInput) =>
  Effect.gen(function* () {
    if (input.file.size > MAX_IMAGE_BYTES) {
      return yield* new FileTooLargeError({
        message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        maxBytes: MAX_IMAGE_BYTES,
      })
    }

    if (input.options.width * input.options.height > MAX_IMAGE_PIXELS) {
      return yield* new ImageProcessingError({
        message: `Keep the output under ${MAX_IMAGE_PIXELS / 1_000_000} megapixels.`,
      })
    }

    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => input.file.arrayBuffer(),
        catch: () => new ImageProcessingError({ message: "Could not read this image." }),
      }),
    )
    const source = detectImageFormat(bytes)

    if (source === null) {
      return yield* new ImageProcessingError({ message: "The file is not a readable image." })
    }

    const format = input.format === "original" ? source : input.format

    preloadImageCodec(format)

    const processor = yield* ImageProcessor
    const output = yield* processor.resize(bytes, input.options, format, input.quality)
    const mimeType = IMAGE_MIME[output.format]

    return {
      blob: new Blob([output.data], { type: mimeType }),
      fileName: `${fileBaseName(input.file.name)}-${output.width}x${output.height}.${IMAGE_EXTENSION[output.format]}`,
      mimeType,
      inputBytes: input.file.size,
      bytes: output.data.byteLength,
      width: output.width,
      height: output.height,
    }
  })

export const resizeImage = (input: ResizeImageInput): Promise<ResizeImageOutput> =>
  runEffect(program(input))
