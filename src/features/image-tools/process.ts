import { Effect } from "effect"

import { FileTooLargeError, ImageProcessingError } from "@/infrastructure/errors/image"
import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { ImageProcessor } from "@/infrastructure/services/image-processor"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import { removeBackground } from "@/libs/utils/background-removal"
import { readImageSize } from "@/libs/utils/image-decode"
import { detectImageFormat } from "@/libs/utils/image-codec"
import { vectorizeImage } from "@/libs/utils/image-vectorizer"
import { createZipWriter } from "@/libs/utils/zip"
import type { PdfImageInput } from "@/libs/utils/pdf/images-to-pdf"
import { jpegOrientation } from "@/libs/utils/image-codec/jpeg"
import {
  IMAGE_EXTENSION,
  IMAGE_MIME,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_FILES,
  MAX_IMAGE_TOTAL_BYTES,
  type ImageFormat,
  type ImageToolFormValues,
  type VectorPreset,
} from "@/libs/schemas/image"
import type { ImagePdfMode, ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { ImagePdfFileEntry } from "./store"

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
const REMOVE_BACKGROUND_FORMATS = new Set(["png", "jpeg", "webp"])

export const validateRemoveBackgroundFile = async (
  file: File,
): Promise<
  { readonly ok: true; readonly file: File } | { readonly ok: false; readonly message: string }
> => {
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    }
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const format = detectImageFormat(header)

  if (!format || !REMOVE_BACKGROUND_FORMATS.has(format)) {
    return { ok: false, message: "Use a PNG, JPEG, or WebP image." }
  }

  return { ok: true, file }
}

export interface PrepareImageFilesInput {
  readonly files: ReadonlyArray<File>
  readonly existingFileCount: number
  readonly existingTotalBytes: number
}

export interface PreparedImageFiles {
  readonly accepted: ReadonlyArray<File>
  readonly errors: ReadonlyArray<string>
}

/** Validates a batch of images for the image-to-PDF tool. */
export const prepareImageFiles = async (
  input: PrepareImageFilesInput,
): Promise<PreparedImageFiles> => {
  const accepted: Array<File> = []
  const errors: Array<string> = []
  let total = input.existingTotalBytes

  for (const file of input.files) {
    if (input.existingFileCount + accepted.length >= MAX_IMAGE_FILES) {
      errors.push(`You can combine at most ${MAX_IMAGE_FILES} images at once.`)
      break
    }

    if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`${file.name} is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`)
      continue
    }

    if (total + file.size > MAX_IMAGE_TOTAL_BYTES) {
      errors.push(`The combined images can be at most ${MAX_IMAGE_TOTAL_BYTES / 1024 / 1024} MB.`)
      continue
    }

    const header = new Uint8Array(await file.slice(0, 64).arrayBuffer())

    if (detectImageFormat(header) === null) {
      errors.push(`${file.name} is not a readable image.`)
      continue
    }

    accepted.push(file)
    total += file.size
  }

  return { accepted, errors }
}

const program = (input: ProcessImageInput) =>
  Effect.gen(function* () {
    if (input.file.size > MAX_IMAGE_BYTES) {
      return yield* new FileTooLargeError({
        message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        maxBytes: MAX_IMAGE_BYTES,
      })
    }

    const processor = yield* ImageProcessor
    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => input.file.arrayBuffer(),
        catch: () => new ImageProcessingError({ message: "Could not read this image." }),
      }),
    )
    const source = detectImageFormat(bytes)
    const format = input.format ?? source ?? (yield* processor.detectFormat(bytes))

    const output = yield* processor.transcode(bytes, format, input.quality)
    // Re-encoding an already optimized file can inflate it, especially a
    // palette PNG that is expanded to RGBA. A compressor must not return a
    // larger file when the format is unchanged. The worker owns `bytes` now,
    // so re-read the file when the original wins.
    const keepOriginal =
      input.mode === "compress" &&
      source !== null &&
      output.format === source &&
      output.data.byteLength >= input.file.size
    const data = keepOriginal
      ? new Uint8Array(
          yield* Effect.tryPromise({
            try: () => input.file.arrayBuffer(),
            catch: () => new ImageProcessingError({ message: "Could not read this image." }),
          }),
        )
      : output.data
    const outputFormat = keepOriginal && source !== null ? source : output.format
    const mimeType = IMAGE_MIME[outputFormat]
    const suffix = input.mode === "compress" ? "-compressed" : ""

    return {
      blob: new Blob([data], { type: mimeType }),
      fileName: `${fileBaseName(input.file.name)}${suffix}.${IMAGE_EXTENSION[outputFormat]}`,
      mimeType,
      originalBytes: input.file.size,
      resultBytes: data.byteLength,
    }
  })

export const processImageEffect = (input: ProcessImageInput) => program(input)

export const processImage = (input: ProcessImageInput): Promise<ProcessImageOutput> =>
  runEffect(program(input))

export interface ProcessImageToolInput {
  readonly mode: ImageToolMode
  readonly file: File
  readonly format: ImageToolFormValues["format"]
  readonly quality: number
}

/** Keeps the SVG branch out of the view while preserving the image contract. */
export const processImageTool = (input: ProcessImageToolInput): Promise<ProcessImageOutput> => {
  if (input.format === "svg") {
    return vectorizeImageToSvg({ file: input.file, preset: "high" }).then((output) => ({
      blob: output.blob,
      fileName: output.fileName,
      mimeType: output.mimeType,
      originalBytes: output.inputBytes,
      resultBytes: output.bytes,
    }))
  }

  return processImage({
    mode: input.mode,
    file: input.file,
    format: input.format === "original" ? undefined : input.format,
    quality: input.quality,
  })
}

export interface ImageToPdfInput {
  readonly files: ReadonlyArray<ImagePdfFileEntry>
  readonly mode: ImagePdfMode
  readonly pageSize: ImagePdfPageSize
  readonly quality: number
}

export interface ImageToPdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly images: number
  readonly pdfs: number
}

const imageBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "image"

const uniquePdfName = (base: string, used: Set<string>) => {
  let name = `${base}.pdf`
  let suffix = 2

  while (used.has(name)) {
    name = `${base}-${suffix}.pdf`
    suffix++
  }

  used.add(name)

  return name
}

const imageToPdfProgram = (input: ImageToPdfInput) =>
  Effect.gen(function* () {
    if (input.files.length === 0) {
      return yield* new PdfProcessingError({ message: "Add at least one image." })
    }

    if (input.files.length > MAX_IMAGE_FILES) {
      return yield* new PdfProcessingError({
        message: `You can combine at most ${MAX_IMAGE_FILES} images at once.`,
      })
    }

    const inputBytes = input.files.reduce((total, entry) => total + entry.size, 0)

    if (inputBytes > MAX_IMAGE_TOTAL_BYTES) {
      return yield* new PdfProcessingError({
        message: `The combined images can be at most ${MAX_IMAGE_TOTAL_BYTES / 1024 / 1024} MB.`,
      })
    }

    const processor = yield* ImageProcessor
    const pdfProcessor = yield* PdfProcessor
    const prepareImage = (
      entry: ImagePdfFileEntry,
    ): Effect.Effect<PdfImageInput, PdfProcessingError | ImageProcessingError> =>
      Effect.gen(function* () {
        if (entry.size > MAX_IMAGE_BYTES) {
          return yield* new PdfProcessingError({
            message: `${entry.name} is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
          })
        }

        const bytes = new Uint8Array(
          yield* Effect.tryPromise({
            try: () => entry.file.arrayBuffer(),
            catch: () => new PdfProcessingError({ message: `Could not read ${entry.name}.` }),
          }),
        )
        const source = detectImageFormat(bytes)

        if (source === null) {
          return yield* new PdfProcessingError({
            message: `${entry.name} is not a readable image.`,
          })
        }

        if (source === "png") {
          // PNG stays byte-for-byte, preserving lossless pixels and alpha.
          return { data: bytes, format: "png" as const }
        }

        if (source === "jpeg" && jpegOrientation(bytes) === 1) {
          // Most JPEGs are already upright; embed them byte-for-byte.
          return { data: bytes, format: "jpeg" as const }
        }

        const output = yield* processor.transcode(
          bytes,
          source === "jpeg" ? "jpeg" : "png",
          source === "jpeg" ? input.quality : 100,
        )

        return { data: output.data, format: source === "jpeg" ? "jpeg" : "png" }
      })

    const firstBase = imageBaseName(input.files[0]!.name)

    if (input.mode === "one") {
      const prepared = yield* Effect.forEach(input.files, prepareImage, { concurrency: 1 })
      const data = yield* pdfProcessor.imagesToPdf(prepared, input.pageSize)

      return {
        blob: new Blob([data], { type: "application/pdf" }),
        fileName: input.files.length === 1 ? `${firstBase}.pdf` : `${firstBase}-images.pdf`,
        bytes: data.byteLength,
        inputBytes,
        images: input.files.length,
        pdfs: 1,
      }
    }

    if (input.files.length === 1) {
      const image = yield* prepareImage(input.files[0]!)
      const data = yield* pdfProcessor.imagesToPdf([image], input.pageSize)

      return {
        blob: new Blob([data], { type: "application/pdf" }),
        fileName: uniquePdfName(imageBaseName(input.files[0]!.name), new Set()),
        bytes: data.byteLength,
        inputBytes,
        images: 1,
        pdfs: 1,
      }
    }

    const writer = createZipWriter()
    const used = new Set<string>()
    let pdfs = 0

    for (const entry of input.files) {
      const image = yield* prepareImage(entry)
      const data = yield* pdfProcessor.imagesToPdf([image], input.pageSize)

      writer.add(uniquePdfName(imageBaseName(entry.name), used), data)
      pdfs += 1
    }

    const blob = writer.finish()
    const error = writer.error()

    if (error) {
      return yield* new PdfProcessingError({ message: "Could not create the PDF archive." })
    }

    return {
      blob,
      fileName: `${firstBase}-pdfs.zip`,
      bytes: blob.size,
      inputBytes,
      images: input.files.length,
      pdfs,
    }
  })

export const processImagesToPdf = (input: ImageToPdfInput): Promise<ImageToPdfOutput> =>
  runEffect(imageToPdfProgram(input))

export interface RemoveBackgroundInput {
  readonly file: File
}

export interface RemoveBackgroundOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly mimeType: string
  readonly bytes: number
  readonly inputBytes: number
  readonly width: number
  readonly height: number
}

export const removeImageBackground = (
  input: RemoveBackgroundInput,
): Promise<RemoveBackgroundOutput> =>
  runEffect(
    Effect.gen(function* () {
      if (input.file.size > MAX_IMAGE_BYTES) {
        return yield* new ImageProcessingError({
          message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        })
      }

      const size = yield* Effect.tryPromise({
        try: () => readImageSize(input.file),
        catch: () =>
          new ImageProcessingError({
            message: "Could not read this image. Try a PNG, JPEG, or WebP.",
          }),
      })

      if (size.width * size.height > MAX_IMAGE_PIXELS) {
        return yield* new ImageProcessingError({
          message: "Use an image under 24 megapixels for background removal.",
        })
      }

      const blob = yield* removeBackground(input.file)

      const outputSize = yield* Effect.tryPromise({
        try: () => readImageSize(blob),
        catch: () =>
          new ImageProcessingError({
            message: "Could not read the transparent PNG.",
          }),
      })

      return {
        blob,
        fileName: `${fileBaseName(input.file.name)}-transparent.png`,
        mimeType: "image/png",
        bytes: blob.size,
        inputBytes: input.file.size,
        width: outputSize.width,
        height: outputSize.height,
      }
    }),
  )

export interface VectorizeImageInput {
  readonly file: File
  readonly preset: VectorPreset
}

export interface VectorizeImageOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly mimeType: string
  readonly bytes: number
  readonly inputBytes: number
  readonly width: number
  readonly height: number
}

export const vectorizeImageToSvg = (input: VectorizeImageInput): Promise<VectorizeImageOutput> =>
  runEffect(
    Effect.gen(function* () {
      if (input.file.size > MAX_IMAGE_BYTES) {
        return yield* new ImageProcessingError({
          message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        })
      }

      const size = yield* Effect.tryPromise({
        try: () => readImageSize(input.file),
        catch: () =>
          new ImageProcessingError({
            message: "Could not read this image. Try a PNG, JPEG, or WebP.",
          }),
      })

      if (size.width * size.height > MAX_IMAGE_PIXELS) {
        return yield* new ImageProcessingError({
          message: "Use an image under 24 megapixels for SVG tracing.",
        })
      }

      const traced = yield* vectorizeImage(input.file, input.preset)
      const blob = new Blob([traced.svg], { type: "image/svg+xml" })

      return {
        blob,
        fileName: `${fileBaseName(input.file.name)}.svg`,
        mimeType: "image/svg+xml",
        bytes: blob.size,
        inputBytes: input.file.size,
        width: traced.width,
        height: traced.height,
      }
    }),
  )
