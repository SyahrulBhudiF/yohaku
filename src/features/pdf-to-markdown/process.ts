import { Effect, Fiber } from "effect"

import { PdfToMarkdownError } from "@/infrastructure/errors/document-conversion"
import { PdfInvalidFileError, PdfOcrError } from "@/infrastructure/errors/pdf"
import { PdfOcr } from "@/infrastructure/services/pdf-ocr"
import { runEffect } from "@/infrastructure/runtime"
import { isPdfFile } from "@/features/pdf-tools/validation"
import type { DocumentConversionOutput } from "@/features/document-tools/types"
import {
  MAX_PDF_BYTES,
  MAX_PDF_OCR_BATCH_PAGES,
  MAX_PDF_OCR_PAGES,
  MAX_PDF_OCR_SPEED_IMAGE_SIDE,
  MAX_PDF_OCR_IMAGE_SIDE,
  type PdfOcrProgress,
  type PdfOcrQuality,
} from "@/libs/schemas/pdf"
import { extractPdfTextRows } from "@/libs/utils/pdf/extract-text-rows"
import { groupOcrLines } from "@/libs/utils/pdf/ocr-layout"
import { renderPdfPageToOcrBitmap } from "@/libs/utils/pdf/pdfjs"

interface ConvertPdfToMarkdownInput {
  readonly file: File
  readonly recognizeScannedPages: boolean
  readonly preferAccuracy: boolean
  readonly onProgress: (progress: PdfOcrProgress) => void
}

export const convertPdfToMarkdown = (input: ConvertPdfToMarkdownInput) =>
  runEffect(
    Effect.gen(function* () {
      const { file } = input

      if (!isPdfFile(file)) {
        return yield* new PdfInvalidFileError({ message: "Choose a PDF file." })
      }

      if (file.size === 0 || file.size > MAX_PDF_BYTES) {
        return yield* new PdfToMarkdownError({
          message:
            file.size === 0
              ? "This PDF is empty."
              : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
        })
      }

      const ocr = yield* PdfOcr
      const quality: PdfOcrQuality = input.preferAccuracy ? "accuracy" : "speed"
      let modelReady = false
      let modelPreparation: Fiber.Fiber<void, PdfOcrError> | undefined
      let scannedPageCount = 0
      const extracted = yield* Effect.mapError(
        extractPdfTextRows(file, {
          allowEmptyDocument: true,
          ...(input.recognizeScannedPages
            ? {
                onScannedPageDetected: (pageNumber, pageCount) =>
                  Effect.gen(function* () {
                    if (++scannedPageCount > MAX_PDF_OCR_PAGES) {
                      return yield* new PdfOcrError({
                        message: `OCR is limited to ${MAX_PDF_OCR_PAGES} scanned pages per PDF.`,
                      })
                    }

                    if (!modelPreparation) {
                      input.onProgress({ phase: "loading-model", pageNumber, pageCount })
                      modelPreparation = yield* Effect.forkChild(
                        ocr.prepare(quality).pipe(
                          Effect.tap(() =>
                            Effect.sync(() => {
                              modelReady = true
                            }),
                          ),
                        ),
                      )
                    }
                  }),
                onPageProgress: (pageNumber, pageCount) => {
                  if (!modelPreparation) return
                  if (pageNumber !== pageCount && pageNumber % 5 !== 0) return

                  input.onProgress({
                    phase: modelReady ? "scanning" : "loading-model",
                    pageNumber,
                    pageCount,
                  })
                },
                onScannedPages: (pages, pageNumbers, pageCount) =>
                  Effect.scoped(
                    Effect.gen(function* () {
                      const pageNumber = pageNumbers[0]!
                      const pageEndNumber = pageNumbers.at(-1)!
                      const position = { pageNumber, pageEndNumber, pageCount }

                      input.onProgress({ phase: "rendering", ...position })

                      const imageSide =
                        quality === "accuracy"
                          ? MAX_PDF_OCR_IMAGE_SIDE
                          : MAX_PDF_OCR_SPEED_IMAGE_SIDE
                      const rendered = yield* Effect.forEach(
                        pages,
                        (page, index) =>
                          Effect.acquireRelease(
                            renderPdfPageToOcrBitmap(page, imageSide, pageNumbers[index]!),
                            (image) => Effect.sync(() => image.close()),
                          ),
                        { concurrency: MAX_PDF_OCR_BATCH_PAGES },
                      )

                      if (modelPreparation) {
                        if (!modelReady) input.onProgress({ phase: "loading-model", ...position })
                        yield* Fiber.join(modelPreparation)
                      }

                      input.onProgress({ phase: "recognizing", ...position })

                      const lines = yield* ocr.recognizePages(rendered, quality)

                      return lines.map(groupOcrLines)
                    }),
                  ),
              }
            : {}),
        }),
        (error) => new PdfToMarkdownError({ message: error.message }),
      )

      if (!extracted.pages.some((rows) => rows.length > 0)) {
        return yield* new PdfToMarkdownError({
          message: input.recognizeScannedPages
            ? "No readable text was found. Try a clearer or higher-resolution scan."
            : "No selectable text was found. Turn on OCR to read scanned pages.",
        })
      }

      const markdown = extracted.pages
        .map((rows, index) => {
          const content = rows
            .map((row) => row.text.replaceAll("\t", "    |    ").replace(/^\s*[•●▪◦‣]\s*/u, "- "))
            .join("\n")

          return `## Page ${index + 1}${content ? `\n\n${content}` : ""}`
        })
        .join("\n\n---\n\n")
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })

      return {
        blob,
        fileName: `${file.name.replace(/\.pdf$/i, "") || "document"}.md`,
        inputBytes: file.size,
        outputBytes: blob.size,
        text: markdown,
      } satisfies DocumentConversionOutput
    }),
  )
