import { readFileSync } from "node:fs"

import { Document, Packer, Paragraph } from "docx"
import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { convert_docx_to_pdf, initSync } from "@/libs/wasm/word-pdf-core/word_pdf_core.js"
import { extractPdfText } from "../../support/pdf"

const wasmPath = new URL(
  "../../../src/libs/wasm/word-pdf-core/word_pdf_core_bg.wasm",
  import.meta.url,
)

initSync({ module: readFileSync(wasmPath) })

const makeDocx = async () => {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph("Yohaku conversion verification"),
          new Paragraph("This text must remain searchable in the PDF."),
        ],
      },
    ],
  })

  return new Uint8Array(await Packer.toBuffer(document))
}

describe("word-pdf-core", () => {
  it("renders DOCX text into a readable PDF", async () => {
    const pdf = convert_docx_to_pdf(await makeDocx())
    const document = await PDFDocument.load(pdf)
    const text = (await extractPdfText(pdf)).join(" ")

    expect(pdf.subarray(0, 4)).toEqual(new Uint8Array([37, 80, 68, 70]))
    expect(document.getPageCount()).toBe(1)
    expect(text).toContain("Yohaku conversion verification")
    expect(text).toContain("searchable in the PDF")
  })

  it("returns a DOCX-specific error for invalid input", () => {
    expect(() => convert_docx_to_pdf(new Uint8Array([1, 2, 3]))).toThrow(/opening DOCX/)
  })
})
