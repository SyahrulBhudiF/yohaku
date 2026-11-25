import { readFileSync } from "node:fs"

import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { convert_pptx_to_pdf, initSync } from "@/libs/wasm/pptx-pdf-core/pptx_pdf_core.js"

const wasmPath = new URL(
  "../../../src/libs/wasm/pptx-pdf-core/pptx_pdf_core_bg.wasm",
  import.meta.url,
)
const fixturePath = new URL("../../support/fixtures/pptx-to-pdf.pptx", import.meta.url)

initSync({ module: readFileSync(wasmPath) })

const convert = () => convert_pptx_to_pdf(new Uint8Array(readFileSync(fixturePath)))

describe("pptx-pdf-core", () => {
  it("writes one page per slide at the presentation size", async () => {
    const document = await PDFDocument.load(convert())
    const first = document.getPage(0)

    expect(document.getPageCount()).toBe(3)
    expect(first.getWidth()).toBeCloseTo(960, 0)
    expect(first.getHeight()).toBeCloseTo(540, 0)
  })

  it("rejects files that are not presentation packages", () => {
    expect(() => convert_pptx_to_pdf(new Uint8Array([1, 2, 3]))).toThrow(/readable/)
  })
})
