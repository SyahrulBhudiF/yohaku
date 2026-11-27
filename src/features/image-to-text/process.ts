import { Effect, Schema } from "effect"

import { ImageOcrError } from "@/infrastructure/errors/image-ocr"
import { PdfOcr } from "@/infrastructure/services/pdf-ocr"
import { runEffect } from "@/infrastructure/runtime"
import {
  ImageOcrOutputSchema,
  MAX_IMAGE_OCR_BYTES,
  MAX_IMAGE_OCR_PIXELS,
  MAX_IMAGE_OCR_SIDE,
  type ImageOcrFormValues,
  type ImageOcrProgress,
} from "@/libs/schemas/image-ocr"
import { detectImageInputFormat } from "@/libs/utils/image-codec"
import { readFileHeader } from "@/libs/utils/image-decode"
import { groupOcrLines } from "@/libs/utils/pdf/ocr-layout"

export interface ConvertImageToTextInput extends ImageOcrFormValues {
  readonly file: File
  readonly onProgress: (progress: ImageOcrProgress) => void
}

const decodeImage = (file: File) =>
  Effect.tryPromise({
    try: async () => {
      const original = await createImageBitmap(file)
      const pixels = original.width * original.height
      const scale = Math.min(
        1,
        MAX_IMAGE_OCR_SIDE / Math.max(original.width, original.height),
        Math.sqrt(MAX_IMAGE_OCR_PIXELS / pixels),
      )

      if (scale >= 1) return original

      const width = Math.max(1, Math.round(original.width * scale))
      const height = Math.max(1, Math.round(original.height * scale))

      try {
        return await createImageBitmap(original, 0, 0, original.width, original.height, {
          resizeWidth: width,
          resizeHeight: height,
          resizeQuality: "high",
        })
      } finally {
        original.close()
      }
    },
    catch: () =>
      new ImageOcrError({
        message: "This image could not be read. Choose a PNG, JPEG, WebP, AVIF, or GIF image.",
      }),
  })

export const convertImageToTextProgram = (input: ConvertImageToTextInput) =>
  Effect.gen(function* () {
    const { file } = input

    if (file.size === 0 || file.size > MAX_IMAGE_OCR_BYTES) {
      return yield* new ImageOcrError({
        message:
          file.size === 0
            ? "This image is empty."
            : `Images can be at most ${MAX_IMAGE_OCR_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (file.type && !file.type.startsWith("image/")) {
      return yield* new ImageOcrError({ message: "Choose an image file to read." })
    }

    const header = yield* Effect.tryPromise({
      try: () => readFileHeader(file, 16),
      catch: () => new ImageOcrError({ message: "Could not read this image." }),
    })
    const format = detectImageInputFormat(header)

    if (
      format !== "png" &&
      format !== "jpeg" &&
      format !== "webp" &&
      format !== "avif" &&
      format !== "gif"
    ) {
      return yield* new ImageOcrError({
        message: "Choose a PNG, JPEG, WebP, AVIF, or GIF image.",
      })
    }

    const ocr = yield* PdfOcr
    const quality = input.preferAccuracy ? "accuracy" : "speed"

    input.onProgress({ phase: "loading-model" })
    yield* ocr
      .prepare(quality)
      .pipe(Effect.mapError((error) => new ImageOcrError({ message: error.message })))

    const text = yield* Effect.acquireUseRelease(
      decodeImage(file),
      (bitmap) =>
        Effect.gen(function* () {
          input.onProgress({ phase: "recognizing" })
          const pages = yield* ocr
            .recognizePages([bitmap], quality)
            .pipe(Effect.mapError((error) => new ImageOcrError({ message: error.message })))
          const lines = pages[0] ?? []
          const text = groupOcrLines(lines)
            .map((row) => row.text)
            .join("\n")

          if (!text.trim()) {
            return yield* new ImageOcrError({
              message:
                "No readable text was found. Try a clearer image or turn on higher accuracy.",
            })
          }

          return text
        }),
      (bitmap) => Effect.sync(() => bitmap.close()),
    )

    const output = {
      text,
      fileName: `${file.name.replace(/\.[^.]+$/, "") || "image"}.txt`,
      inputBytes: file.size,
      outputBytes: new TextEncoder().encode(text).byteLength,
    }

    return yield* Schema.decodeEffect(ImageOcrOutputSchema)(output).pipe(
      Effect.mapError(
        () => new ImageOcrError({ message: "Could not prepare the extracted text." }),
      ),
    )
  })

export const convertImageToText = (input: ConvertImageToTextInput) =>
  runEffect(convertImageToTextProgram(input))
