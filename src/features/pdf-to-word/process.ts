import { Effect } from "effect"

import { PdfToWordError } from "@/infrastructure/errors/document-conversion"
import { PdfInvalidFileError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { extractPdfTextRows } from "@/libs/utils/pdf/extract-text-rows"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { isPdfFile } from "@/features/pdf-tools/validation"

export interface PdfToWordOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly pages: number
}

export const convertPdfToWord = (file: File): Promise<PdfToWordOutput> =>
  runEffect(
    Effect.gen(function* () {
      if (!isPdfFile(file)) {
        return yield* new PdfInvalidFileError({ message: "Choose a PDF file." })
      }

      if (file.size === 0 || file.size > MAX_PDF_BYTES) {
        return yield* new PdfToWordError({
          message:
            file.size === 0
              ? "This PDF is empty."
              : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
        })
      }

      const extracted = yield* extractPdfTextRows(file)

      const blob = yield* Effect.tryPromise({
        try: async () => {
          const { createWordBlob } = await import("./document")

          return createWordBlob(extracted)
        },
        catch: () =>
          new PdfToWordError({
            message: "Could not package the extracted text as a Word document.",
          }),
      })

      return {
        blob,
        fileName: `${file.name.replace(/\.pdf$/i, "") || "document"}.docx`,
        inputBytes: file.size,
        outputBytes: blob.size,
        pages: extracted.pageCount,
      }
    }),
  )
