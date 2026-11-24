import { Effect } from "effect"
import type { TextItem } from "pdfjs-dist/types/src/display/api"

import { PdfTextExtractionError } from "@/infrastructure/errors/document-conversion"
import { MAX_PDF_PAGES } from "@/libs/schemas/pdf"
import { groupPdfTextRows, type PdfTextRow } from "./text-layout"
import { loadPdfDocument } from "./pdfjs"

export interface ExtractedPdfText {
  readonly pages: readonly (readonly PdfTextRow[])[]
  readonly pageCount: number
}

export const extractPdfTextRows = (
  file: File,
): Effect.Effect<ExtractedPdfText, PdfTextExtractionError> =>
  Effect.tryPromise({
    try: async () => {
      const loaded = await loadPdfDocument(file)

      try {
        if (loaded.pageCount > MAX_PDF_PAGES) {
          throw new PdfTextExtractionError({
            message: `PDFs can have at most ${MAX_PDF_PAGES.toLocaleString()} pages.`,
          })
        }

        const pages: PdfTextRow[][] = []

        for (let pageNumber = 1; pageNumber <= loaded.pageCount; pageNumber++) {
          const page = await loaded.document.getPage(pageNumber)
          const content = await page.getTextContent()
          const items = content.items.filter((item): item is TextItem => "str" in item)

          pages.push(groupPdfTextRows(items))
          page.cleanup()
        }

        if (!pages.some((rows) => rows.length > 0)) {
          throw new PdfTextExtractionError({
            message:
              "No selectable text was found. Scanned PDFs need OCR, which this tool does not provide.",
          })
        }

        return { pages, pageCount: loaded.pageCount }
      } finally {
        await loaded.destroy()
      }
    },
    catch: (cause) => {
      if (cause instanceof PdfTextExtractionError) {
        return cause
      }

      return new PdfTextExtractionError({
        message:
          cause instanceof Error && cause.name === "PasswordException"
            ? "This PDF is password protected. Remove its password before converting."
            : "Could not read this PDF. Check that it is valid and not password protected.",
      })
    },
  })
