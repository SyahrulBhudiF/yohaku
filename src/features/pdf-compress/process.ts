import { Effect } from "effect"

import { PdfCompressionError, PdfInvalidFileError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import { MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/libs/schemas/pdf"
import { isPdfFile } from "@/features/pdf-tools/validation"

export interface CompressPdfInput {
  readonly file: File
  readonly password?: string
}

export interface CompressPdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly pages: number
}

export const compressPdfFile = ({ file, password }: CompressPdfInput): Promise<CompressPdfOutput> =>
  runEffect(
    Effect.gen(function* () {
      if (!isPdfFile(file)) {
        return yield* new PdfInvalidFileError({ message: "Choose a PDF file." })
      }

      if (file.size === 0 || file.size > MAX_PDF_BYTES) {
        return yield* new PdfCompressionError({
          message:
            file.size === 0
              ? "This PDF is empty."
              : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
        })
      }

      const processor = yield* PdfProcessor
      const result = yield* processor.compress(file, password)

      if (result.pages > MAX_PDF_PAGES) {
        return yield* new PdfCompressionError({
          message: `PDFs can have at most ${MAX_PDF_PAGES.toLocaleString()} pages.`,
        })
      }

      return {
        blob: new Blob([result.data], { type: "application/pdf" }),
        fileName: `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`,
        inputBytes: result.inputBytes,
        outputBytes: result.outputBytes,
        pages: result.pages,
      }
    }),
  )
