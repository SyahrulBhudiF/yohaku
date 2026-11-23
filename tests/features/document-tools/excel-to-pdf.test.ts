import { readFileSync } from "node:fs"

import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { convert_xlsx_to_pdf, initSync } from "@/libs/wasm/xlsx-pdf-core/xlsx_pdf_core.js"

const wasmPath = new URL(
  "../../../src/libs/wasm/xlsx-pdf-core/xlsx_pdf_core_bg.wasm",
  import.meta.url,
)
const fixturePath = new URL("../../support/fixtures/excel-to-pdf.xlsx", import.meta.url)

initSync({ module: readFileSync(wasmPath) })

const convert = (pageSize = "a4", orientation = "landscape") =>
  convert_xlsx_to_pdf(new Uint8Array(readFileSync(fixturePath)), pageSize, orientation)

describe("xlsx-pdf-core", () => {
  it("writes one page per sheet", async () => {
    const document = await PDFDocument.load(convert())
    const first = document.getPage(0)

    expect(document.getPageCount()).toBe(2)
    expect(first.getWidth()).toBeCloseTo(841.89, 1)
    expect(first.getHeight()).toBeCloseTo(595.28, 1)
  })

  it("supports portrait pages", async () => {
    const document = await PDFDocument.load(convert("a4", "portrait"))
    const first = document.getPage(0)

    expect(first.getWidth()).toBeCloseTo(595.28, 1)
    expect(first.getHeight()).toBeCloseTo(841.89, 1)
  })

  it("rejects files that are not workbooks", () => {
    expect(() => convert_xlsx_to_pdf(new Uint8Array([1, 2, 3]), "a4", "landscape")).toThrow(
      /readable/,
    )
  })
})
