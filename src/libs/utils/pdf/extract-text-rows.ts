import { Effect } from "effect"
import type { PDFPageProxy } from "pdfjs-dist"
import type { TextItem } from "pdfjs-dist/types/src/display/api"

import { PdfTextExtractionError } from "@/infrastructure/errors/document-conversion"
import type { PdfOcrError } from "@/infrastructure/errors/pdf"
import { MAX_PDF_OCR_BATCH_PAGES, MAX_PDF_PAGES } from "@/libs/schemas/pdf"
import { groupPdfTextRows, type PdfTextRow } from "./text-layout"
import { loadPdfDocument } from "./pdfjs"

export interface ExtractedPdfText {
  readonly pages: readonly (readonly PdfTextRow[])[]
  readonly pageCount: number
}

export interface ExtractPdfTextRowsOptions {
  readonly allowEmptyDocument?: boolean
  readonly onScannedPageDetected?: (
    pageNumber: number,
    pageCount: number,
  ) => Effect.Effect<void, PdfOcrError>
  readonly onPageProgress?: (pageNumber: number, pageCount: number) => void
  readonly onScannedPages?: (
    pages: ReadonlyArray<PDFPageProxy>,
    pageNumbers: ReadonlyArray<number>,
    pageCount: number,
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<PdfTextRow>>, PdfOcrError>
}

const readPdf = <A>(read: () => Promise<A>) =>
  Effect.tryPromise({
    try: read,
    catch: (cause) =>
      new PdfTextExtractionError({
        message:
          cause instanceof Error && cause.name === "PasswordException"
            ? "This PDF is password protected. Remove its password before converting."
            : "Could not read this PDF. Check that it is valid and not password protected.",
      }),
  })

export const extractPdfTextRows = (
  file: File,
  options: ExtractPdfTextRowsOptions = {},
): Effect.Effect<ExtractedPdfText, PdfTextExtractionError> =>
  Effect.acquireUseRelease(
    readPdf(() => loadPdfDocument(file)),
    (loaded) =>
      Effect.gen(function* () {
        if (loaded.pageCount > MAX_PDF_PAGES) {
          return yield* new PdfTextExtractionError({
            message: `PDFs can have at most ${MAX_PDF_PAGES.toLocaleString()} pages.`,
          })
        }

        const pages: ReadonlyArray<PdfTextRow>[] = []
        const scannedPageNumbers: number[] = []
        const getPage = (pageNumber: number) => readPdf(() => loaded.document.getPage(pageNumber))

        for (let pageNumber = 1; pageNumber <= loaded.pageCount; pageNumber++) {
          const content = yield* Effect.acquireUseRelease(
            getPage(pageNumber),
            (page) => readPdf(() => page.getTextContent()),
            (page) => Effect.sync(() => page.cleanup()),
          )
          const items = content.items.filter((item): item is TextItem => "str" in item)
          const rows = groupPdfTextRows(items)

          pages.push(rows)

          if (rows.length === 0 && options.onScannedPages) {
            scannedPageNumbers.push(pageNumber)

            if (options.onScannedPageDetected) {
              yield* options.onScannedPageDetected(pageNumber, loaded.pageCount)
            }
          }

          options.onPageProgress?.(pageNumber, loaded.pageCount)
        }

        const { onScannedPages } = options

        if (onScannedPages) {
          for (
            let offset = 0;
            offset < scannedPageNumbers.length;
            offset += MAX_PDF_OCR_BATCH_PAGES
          ) {
            const pageNumbers = scannedPageNumbers.slice(offset, offset + MAX_PDF_OCR_BATCH_PAGES)
            const batchRows = yield* Effect.scoped(
              Effect.gen(function* () {
                const scannedPages = yield* Effect.forEach(
                  pageNumbers,
                  (number) =>
                    Effect.acquireRelease(getPage(number), (page) =>
                      Effect.sync(() => page.cleanup()),
                    ),
                  { concurrency: MAX_PDF_OCR_BATCH_PAGES },
                )

                return yield* onScannedPages(scannedPages, pageNumbers, loaded.pageCount)
              }),
            )

            batchRows.forEach((rows, index) => {
              pages[pageNumbers[index]! - 1] = rows
            })
          }
        }

        if (!options.allowEmptyDocument && !pages.some((rows) => rows.length > 0)) {
          return yield* new PdfTextExtractionError({
            message:
              "No selectable text was found. Scanned PDFs need OCR, which this tool does not provide.",
          })
        }

        return { pages, pageCount: loaded.pageCount }
      }).pipe(
        Effect.catchTag("PdfOcrError", (error) =>
          Effect.fail(new PdfTextExtractionError({ message: `OCR failed: ${error.message}` })),
        ),
      ),
    (loaded) => Effect.ignore(readPdf(loaded.destroy)),
  )
