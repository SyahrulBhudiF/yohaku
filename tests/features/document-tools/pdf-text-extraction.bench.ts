import { PDFDocument, StandardFonts } from "pdf-lib"
import { beforeAll, test } from "vitest"

import { extractPdfText } from "../../support/pdf"
import { createExcelBlob } from "@/features/pdf-to-excel/workbook"
import { createWordBlob } from "@/features/pdf-to-word/document"
import { groupPdfTextRows } from "@/libs/utils/pdf/text-layout"
import type { TextItem } from "pdfjs-dist/types/src/display/api"

const positionedRows = async (bytes: Uint8Array) => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const task = getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false })
  const document = await task.promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => "str" in item)

    pages.push(groupPdfTextRows(items))
  }

  await task.destroy()

  return { pages, pageCount: document.numPages }
}

const PAGE_COUNTS = [10, 100]
const files = new Map<number, Uint8Array>()

beforeAll(async () => {
  for (const pageCount of PAGE_COUNTS) {
    const document = await PDFDocument.create()
    const font = await document.embedFont(StandardFonts.Helvetica)

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = document.addPage()

      page.drawText(`Report page ${pageNumber} — quarterly revenue and expenses`, { font })

      for (let row = 0; row < 24; row++) {
        const y = 700 - row * 22

        page.drawText(`Item ${row + 1}`, { font, x: 72, y })
        page.drawText(`${(row + 1) * 10}`, { font, x: 220, y })
        page.drawText(`${(row + 1) * 20}`, { font, x: 360, y })
        page.drawText(`${(row + 1) * 30}`, { font, x: 500, y })
      }
    }

    files.set(pageCount, new Uint8Array(await document.save()))
  }
})

for (const pageCount of PAGE_COUNTS) {
  test(`extracts text from ${pageCount} PDF pages`, { timeout: 120_000 }, async ({ bench }) => {
    const bytes = files.get(pageCount)!

    await bench(
      `pdfjs text extraction · ${pageCount} pages · ${bytes.byteLength} bytes`,
      { writeResult: `.amp/in/bench-pdf-text-${pageCount}.json` },
      () => extractPdfText(bytes),
    ).run()

    await bench(
      `pdfjs → docx · ${pageCount} pages · ${bytes.byteLength} bytes`,
      { writeResult: `.amp/in/bench-pdf-docx-${pageCount}.json` },
      async () => createWordBlob(await positionedRows(bytes)),
    ).run()

    await bench(
      `pdfjs → xlsx · ${pageCount} pages · ${bytes.byteLength} bytes`,
      { writeResult: `.amp/in/bench-pdf-xlsx-${pageCount}.json` },
      async () => createExcelBlob(await positionedRows(bytes)),
    ).run()
  })
}
