import { Effect } from "effect"

import { PdfToExcelError } from "@/infrastructure/errors/document-conversion"
import { PdfInvalidFileError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { extractPdfTextRows } from "@/libs/utils/pdf/extract-text-rows"
import { isPdfFile } from "@/features/pdf-tools/validation"

export interface PdfToExcelOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly pages: number
}

export const convertPdfToExcel = (file: File): Promise<PdfToExcelOutput> =>
  runEffect(
    Effect.gen(function* () {
      if (!isPdfFile(file)) {
        return yield* new PdfInvalidFileError({ message: "Choose a PDF file." })
      }

      if (file.size === 0 || file.size > MAX_PDF_BYTES) {
        return yield* new PdfToExcelError({
          message:
            file.size === 0
              ? "This PDF is empty."
              : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
        })
      }

      const extracted = yield* extractPdfTextRows(file)

      const blob = yield* Effect.tryPromise({
        try: async () => {
          const { createExcelBlob } = await import("./workbook")

          return createExcelBlob(extracted)
        },
        catch: () =>
          new PdfToExcelError({
            message: "Could not package the extracted rows as an Excel workbook.",
          }),
      })

      return {
        blob,
        fileName: `${file.name.replace(/\.pdf$/i, "") || "document"}.xlsx`,
        inputBytes: file.size,
        outputBytes: blob.size,
        pages: extracted.pageCount,
      }
    }),
  )
