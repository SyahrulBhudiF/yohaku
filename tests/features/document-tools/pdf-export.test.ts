import * as XLSX from "xlsx"
import { unzipSync, strFromU8 } from "fflate"
import { describe, expect, it } from "vitest"

import { createExcelBlob } from "@/features/pdf-to-excel/workbook"
import { createWordBlob } from "@/features/pdf-to-word/document"
import type { ExtractedPdfText } from "@/libs/utils/pdf/extract-text-rows"

const pages: ExtractedPdfText = {
  pageCount: 2,
  pages: [
    [
      {
        y: 720,
        cells: [
          { x: 72, text: "Item" },
          { x: 220, text: "Amount" },
        ],
        text: "Item\tAmount",
      },
      {
        y: 690,
        cells: [
          { x: 72, text: "Recycled office paper" },
          { x: 220, text: "120" },
        ],
        text: "Recycled office paper\t120",
      },
    ],
    [{ y: 720, cells: [{ x: 72, text: "Page two" }], text: "Page two" }],
  ],
}

describe("PDF document exports", () => {
  it("creates an editable DOCX with the text and source page breaks", async () => {
    const blob = await createWordBlob(pages)
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const documentXml = strFromU8(files["word/document.xml"]!)

    expect(documentXml).toContain("Recycled office paper")
    expect(documentXml).toContain("Page two")
    expect(documentXml).toContain("pageBreakBefore")
  })

  it("creates one worksheet per page and keeps inferred columns", async () => {
    const blob = createExcelBlob(pages)
    const workbook = XLSX.read(await blob.arrayBuffer(), { type: "array", cellStyles: true })
    const firstPage = workbook.Sheets["Page 1"]!

    expect(workbook.SheetNames).toEqual(["Page 1", "Page 2"])
    expect(firstPage.A1?.v).toBe("Item")
    expect(firstPage.A2?.v).toBe("Recycled office paper")
    expect(firstPage.B2?.v).toBe("120")
    expect(firstPage["!cols"]?.[0]?.wch).toBe(23)
  })
})
