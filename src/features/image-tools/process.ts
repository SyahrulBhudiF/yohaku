import { Effect } from "effect"

import { FileTooLargeError } from "@/infrastructure/errors/image"
import { runEffect } from "@/infrastructure/runtime"
import { ImageProcessor } from "@/infrastructure/services/image-processor"
import { detectImageFormat, preloadImageCodec } from "@/libs/utils/image-codec"
import {
  IMAGE_EXTENSION,
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  type ImageFormat,
} from "@/libs/schemas/image"

export type ImageToolMode = "convert" | "compress"

export interface ProcessImageInput {
  readonly mode: ImageToolMode
  readonly file: File
  readonly format: ImageFormat | undefined
  readonly quality: number
}

export interface ProcessImageOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly mimeType: string
  readonly originalBytes: number
  readonly resultBytes: number
}

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "image"

const program = (input: ProcessImageInput) =>
  Effect.gen(function* () {
    if (input.file.size > MAX_IMAGE_BYTES) {
      return yield* new FileTooLargeError({
        message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        maxBytes: MAX_IMAGE_BYTES,
      })
    }

    const processor = yield* ImageProcessor
    const bytes = new Uint8Array(yield* Effect.promise(() => input.file.arrayBuffer()))
    const source = detectImageFormat(bytes)
    const format = input.format ?? source ?? (yield* processor.detectFormat(bytes))

    // Start the encoder download while the source image decodes.
    void preloadImageCodec(format, "encode")

    const output = yield* processor.transcode(bytes, format, input.quality)
    const mimeType = IMAGE_MIME[output.format]
    const suffix = input.mode === "compress" ? "-compressed" : ""

    return {
      blob: new Blob([output.data], { type: mimeType }),
      fileName: `${fileBaseName(input.file.name)}${suffix}.${IMAGE_EXTENSION[output.format]}`,
      mimeType,
      originalBytes: input.file.size,
      resultBytes: output.data.byteLength,
    }
  })

export const processImage = (input: ProcessImageInput): Promise<ProcessImageOutput> =>
  runEffect(program(input))
