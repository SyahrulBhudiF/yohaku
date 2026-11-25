import { Effect } from "effect"

import { PdfToMarkdownError } from "@/infrastructure/errors/document-conversion"
import { PdfInvalidFileError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { isPdfFile } from "@/features/pdf-tools/validation"
import type { DocumentConversionOutput } from "@/features/document-tools/types"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { extractPdfTextRows } from "@/libs/utils/pdf/extract-text-rows"

export const convertPdfToMarkdown = (file: File) =>
  runEffect(
    Effect.gen(function* () {
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

      const extracted = yield* Effect.mapError(
        extractPdfTextRows(file),
        (error) => new PdfToMarkdownError({ message: error.message }),
      )
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
