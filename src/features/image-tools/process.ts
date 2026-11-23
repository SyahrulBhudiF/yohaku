import { Effect } from "effect"
import { zipSync } from "fflate"

import { FileTooLargeError } from "@/infrastructure/errors/image"
import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { ImageProcessor } from "@/infrastructure/services/image-processor"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import { detectImageFormat, preloadImageCodec } from "@/libs/utils/image-codec"
import { jpegOrientation } from "@/libs/utils/image-codec/jpeg"
import {
  IMAGE_EXTENSION,
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_FILES,
  MAX_IMAGE_TOTAL_BYTES,
  type ImageFormat,
} from "@/libs/schemas/image"
import type { ImagePdfMode, ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { PdfImageInput } from "@/libs/utils/pdf/images-to-pdf"
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
    preloadImageCodec(format)

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
    const prepared: Array<PdfImageInput> = []

    for (const entry of input.files) {
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
        prepared.push({ data: bytes, format: "png" })
        continue
      }

      if (source === "jpeg") {
        // Most JPEGs are already upright; embed them byte-for-byte. Only a
        // non-default EXIF orientation needs a decode/re-encode round trip.
        if (jpegOrientation(bytes) === 1) {
          prepared.push({ data: bytes, format: "jpeg" })
        } else {
          const output = yield* processor.transcode(bytes, "jpeg", input.quality)

          prepared.push({ data: output.data, format: "jpeg" })
        }

        continue
      }

      const output = yield* processor.transcode(bytes, "png", 100)

      prepared.push({ data: output.data, format: "png" })
    }

    const firstBase = imageBaseName(input.files[0]!.name)

    if (input.mode === "one") {
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

    const used = new Set<string>()
    const pdfs: Array<{ readonly name: string; readonly data: Uint8Array<ArrayBuffer> }> = []

    for (const [index, image] of prepared.entries()) {
      const data = yield* pdfProcessor.imagesToPdf([image], input.pageSize)

      pdfs.push({
        name: uniquePdfName(imageBaseName(input.files[index]!.name), used),
        data,
      })
    }

    if (pdfs.length === 1) {
      const only = pdfs[0]!

      return {
        blob: new Blob([only.data], { type: "application/pdf" }),
        fileName: only.name,
        bytes: only.data.byteLength,
        inputBytes,
        images: 1,
        pdfs: 1,
      }
    }

    const entries: Record<string, Uint8Array> = {}

    for (const pdf of pdfs) {
      entries[pdf.name] = pdf.data
    }

    const zip = zipSync(entries, { level: 0 })

    return {
      blob: new Blob([zip], { type: "application/zip" }),
      fileName: `${firstBase}-pdfs.zip`,
      bytes: zip.byteLength,
      inputBytes,
      images: input.files.length,
      pdfs: pdfs.length,
    }
  })

export const processImagesToPdf = (input: ImageToPdfInput): Promise<ImageToPdfOutput> =>
  runEffect(imageToPdfProgram(input))
