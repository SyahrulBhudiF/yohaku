import { Effect, Fiber } from "effect"
import { zipSync } from "fflate"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { ImageProcessor } from "@/infrastructure/services/image-processor"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import { IMAGE_EXTENSION, IMAGE_MIME, type ImageFormat } from "@/libs/schemas/image"
import {
  MAX_PDF_BYTES,
  MAX_PDF_IMAGE_PAGES,
  MAX_PDF_PAGES,
  MAX_SPLIT_OUTPUTS,
  type PdfImageDpi,
  type PdfPageRange,
  type PdfSplitMode,
} from "@/libs/schemas/pdf"
import { imageWorkerLimit } from "@/libs/utils/image-codec"
import { isPreviewableImageMime } from "@/libs/utils/image-preview"
import type { PdfMergePage } from "@/libs/utils/pdf/qpdf"
import { disposePdfFile, getPdfDocument } from "./thumbnails"
import type { PdfFileEntry, PdfPageEntry } from "./store"

export type PreparePdfResult =
  | { readonly ok: true; readonly pageCount: number }
  | {
      readonly ok: false
      readonly reason: "password" | "invalid" | "too-large" | "too-many-pages"
      readonly message: string
    }

export const preparePdfFile = async (
  fileId: string,
  file: File,
  password?: string,
): Promise<PreparePdfResult> => {
  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB each.`,
    }
  }

  try {
    const document = await getPdfDocument(fileId, file, password)

    if (document.pageCount > MAX_PDF_PAGES) {
      disposePdfFile(fileId)

      return {
        ok: false,
        reason: "too-many-pages",
        message: `PDFs can have at most ${MAX_PDF_PAGES.toLocaleString()} pages.`,
      }
    }

    return { ok: true, pageCount: document.pageCount }
  } catch (cause) {
    const name = typeof cause === "object" && cause !== null && "name" in cause ? cause.name : null

    if (name === "PasswordException") {
      return {
        ok: false,
        reason: "password",
        message: password
          ? "That password did not open the PDF."
          : "This PDF is password-protected. Enter its password to continue.",
      }
    }

    return {
      ok: false,
      reason: "invalid",
      message: "This file is not a readable PDF.",
    }
  }
}

export interface MergePdfInput {
  readonly files: ReadonlyArray<PdfFileEntry>
  readonly pages: ReadonlyArray<PdfPageEntry>
}

export interface MergePdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly pages: number
}

export const mergePdfPages = (input: MergePdfInput): Promise<MergePdfOutput> =>
  runEffect(
    Effect.gen(function* () {
      const processor = yield* PdfProcessor
      const filesById = new Map(input.files.map((file) => [file.id, file]))
      const pages: Array<PdfMergePage> = []

      for (const page of input.pages) {
        const file = filesById.get(page.fileId)

        if (!file) {
          return yield* new PdfProcessingError({ message: "A selected PDF is missing." })
        }

        pages.push({
          fileId: page.fileId,
          file: file.file,
          pageNumber: page.pageNumber,
          password: file.password,
        })
      }

      const data = yield* processor.mergePages(pages)

      return {
        blob: new Blob([data], { type: "application/pdf" }),
        fileName: "merged.pdf",
        bytes: data.byteLength,
        inputBytes: input.files.reduce((total, file) => total + file.size, 0),
        pages: input.pages.length,
      }
    }),
  )

export interface SplitPdfInput {
  readonly file: PdfFileEntry
  readonly mode: PdfSplitMode
  readonly pagesPerFile: number
  readonly ranges: ReadonlyArray<PdfPageRange>
}

export interface SplitPdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly pages: number
  readonly outputs: number
}

const fileBaseName = (name: string) => name.replace(/\.pdf$/i, "") || "pdf"

export const splitPdf = (input: SplitPdfInput): Promise<SplitPdfOutput> =>
  runEffect(
    Effect.gen(function* () {
      const processor = yield* PdfProcessor
      const request =
        input.mode === "ranges"
          ? {
              mode: "ranges" as const,
              file: input.file.file,
              ranges: input.ranges,
              password: input.file.password,
            }
          : {
              mode: "chunks" as const,
              file: input.file.file,
              pagesPerFile: input.mode === "every" ? 1 : input.pagesPerFile,
              password: input.file.password,
            }
      const outputs = yield* processor.split(request)

      if (outputs.length === 0) {
        return yield* new PdfProcessingError({ message: "This split produced no files." })
      }

      if (outputs.length > MAX_SPLIT_OUTPUTS) {
        return yield* new PdfProcessingError({
          message: `A split can create at most ${MAX_SPLIT_OUTPUTS} files.`,
        })
      }

      if (outputs.length === 1) {
        const only = outputs[0]

        if (!only) {
          return yield* new PdfProcessingError({ message: "This split produced no files." })
        }

        return {
          blob: new Blob([only.data], { type: "application/pdf" }),
          fileName: only.name,
          bytes: only.data.byteLength,
          inputBytes: input.file.size,
          pages: input.file.pageCount,
          outputs: 1,
        }
      }

      const entries: Record<string, Uint8Array> = {}

      for (const output of outputs) {
        entries[output.name] = output.data
      }

      const zip = zipSync(entries, { level: 0 })

      return {
        blob: new Blob([zip], { type: "application/zip" }),
        fileName: `${fileBaseName(input.file.name)}-split.zip`,
        bytes: zip.byteLength,
        inputBytes: input.file.size,
        pages: input.file.pageCount,
        outputs: outputs.length,
      }
    }),
  )

export interface RenderPdfImagesInput {
  readonly file: PdfFileEntry
  readonly pages: ReadonlyArray<number>
  readonly format: ImageFormat
  readonly quality: number
  readonly dpi: PdfImageDpi
}

export interface RenderPdfImagesOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly images: number
  readonly mimeType: string
  readonly preview: { readonly blob: Blob; readonly mimeType: string } | null
}

interface EncodedPage {
  readonly name: string
  readonly data: Uint8Array<ArrayBuffer>
}

export const renderPdfImages = (input: RenderPdfImagesInput): Promise<RenderPdfImagesOutput> =>
  runEffect(
    Effect.gen(function* () {
      const loaded = yield* Effect.tryPromise({
        try: () => getPdfDocument(input.file.id, input.file.file, input.file.password),
        catch: () => new PdfProcessingError({ message: "Could not open this PDF." }),
      })
      const { canvasToBlob, createPdfRenderCanvas, renderPdfPage, renderPdfPageToCanvas } =
        yield* Effect.tryPromise({
          try: () => import("@/libs/utils/pdf/pdfjs"),
          catch: () => new PdfProcessingError({ message: "Could not load the PDF renderer." }),
        })
      const pages = [...new Set(input.pages)].sort((a, b) => a - b)

      if (pages.length === 0) {
        return yield* new PdfProcessingError({ message: "Choose at least one page." })
      }

      if (pages.length > MAX_PDF_IMAGE_PAGES) {
        return yield* new PdfProcessingError({
          message: `PDF to image supports at most ${MAX_PDF_IMAGE_PAGES} pages per run.`,
        })
      }

      for (const pageNumber of pages) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > loaded.pageCount) {
          return yield* new PdfProcessingError({
            message: `Page ${pageNumber} is outside this PDF.`,
          })
        }
      }

      const scale = input.dpi / 72
      const padding = String(loaded.pageCount).length
      const base = input.file.name.replace(/\.pdf$/i, "") || "pdf"
      const processor = yield* ImageProcessor
      const canvas = createPdfRenderCanvas()

      if (!canvas) {
        return yield* new PdfProcessingError({ message: "PDF rendering needs a browser." })
      }

      const outputs: Array<EncodedPage> = []
      const mimeType = IMAGE_MIME[input.format]
      const native = input.format === "png" || input.format === "jpeg"

      if (native) {
        const quality = input.quality / 100

        for (const pageNumber of pages) {
          const target = yield* Effect.tryPromise({
            try: () => renderPdfPageToCanvas(loaded.document, pageNumber, scale, canvas),
            catch: () =>
              new PdfProcessingError({ message: `Could not render page ${pageNumber}.` }),
          })

          if (!target) {
            return yield* new PdfProcessingError({
              message: `Page ${pageNumber} is too large at ${input.dpi} DPI. Try a lower resolution.`,
            })
          }

          const blob = yield* Effect.tryPromise({
            try: () => canvasToBlob(target, mimeType, quality),
            catch: () =>
              new PdfProcessingError({ message: `Could not encode page ${pageNumber}.` }),
          })

          if (!blob) {
            return yield* new PdfProcessingError({
              message: `Could not encode page ${pageNumber} as ${input.format.toUpperCase()}.`,
            })
          }

          const data = new Uint8Array(
            yield* Effect.tryPromise({
              try: () => blob.arrayBuffer(),
              catch: () =>
                new PdfProcessingError({ message: `Could not read page ${pageNumber}.` }),
            }),
          )

          outputs.push({
            name: `${base}-page-${String(pageNumber).padStart(padding, "0")}.${IMAGE_EXTENSION[input.format]}`,
            data,
          })
        }
      } else {
        const maxInFlight = imageWorkerLimit()
        const fibers: Array<Fiber.Fiber<EncodedPage, PdfProcessingError>> = []

        for (const pageNumber of pages) {
          if (fibers.length >= maxInFlight) {
            const oldest = fibers.shift()

            if (oldest) {
              outputs.push(yield* Fiber.join(oldest))
            }
          }

          const image = yield* Effect.tryPromise({
            try: () => renderPdfPage(loaded.document, pageNumber, scale, canvas),
            catch: () =>
              new PdfProcessingError({ message: `Could not render page ${pageNumber}.` }),
          })

          if (!image) {
            return yield* new PdfProcessingError({
              message: `Page ${pageNumber} is too large at ${input.dpi} DPI. Try a lower resolution.`,
            })
          }

          const name = `${base}-page-${String(pageNumber).padStart(padding, "0")}.${IMAGE_EXTENSION[input.format]}`
          const encode = processor.encode(image, input.format, input.quality).pipe(
            Effect.mapError(
              () =>
                new PdfProcessingError({
                  message: `Could not encode page ${pageNumber} as ${input.format.toUpperCase()}.`,
                }),
            ),
            Effect.map((data) => ({ name, data })),
          )

          fibers.push(yield* Effect.forkChild(encode))
        }

        for (const fiber of fibers) {
          outputs.push(yield* Fiber.join(fiber))
        }
      }

      canvas.width = 0
      canvas.height = 0

      const first = outputs[0]

      if (!first) {
        return yield* new PdfProcessingError({ message: "This PDF has no pages." })
      }

      const preview = isPreviewableImageMime(mimeType)
        ? { blob: new Blob([first.data], { type: mimeType }), mimeType }
        : null

      if (outputs.length === 1) {
        return {
          blob: new Blob([first.data], { type: mimeType }),
          fileName: `${base}.${IMAGE_EXTENSION[input.format]}`,
          bytes: first.data.byteLength,
          inputBytes: input.file.size,
          images: 1,
          mimeType,
          preview,
        }
      }

      const entries: Record<string, Uint8Array> = {}

      for (const output of outputs) {
        entries[output.name] = output.data
      }

      const zip = zipSync(entries, { level: 0 })

      return {
        blob: new Blob([zip], { type: "application/zip" }),
        fileName: `${base}-images.zip`,
        bytes: zip.byteLength,
        inputBytes: input.file.size,
        images: outputs.length,
        mimeType: "application/zip",
        preview,
      }
    }),
  )
