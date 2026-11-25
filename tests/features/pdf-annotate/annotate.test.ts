import { PDFDocument, degrees } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { annotatePdf } from "@/features/pdf-annotate/annotate"
import type { PdfAnnotateOptions } from "@/features/pdf-annotate/types"
import { extractPdfText } from "../../support/pdf"

const blankPdf = async (pages: number) => {
  const document = await PDFDocument.create()

  for (let index = 0; index < pages; index += 1) {
    document.addPage([400, 500])
  }

  return new Uint8Array(await document.save())
}

const baseOptions = (overrides: Partial<PdfAnnotateOptions>): PdfAnnotateOptions => ({
  mode: "numbers",
  pages: [1, 2],
  number: {
    start: 1,
    format: "number",
    position: "bottom-center",
    fontSize: 12,
    margin: 24,
  },
  watermark: {
    kind: "text",
    text: "DRAFT",
    placement: "single",
    opacity: 20,
    rotation: -45,
    fontSize: 48,
    scale: 35,
  },
  ...overrides,
})

describe("pdf annotation core", () => {
  it("numbers the selected pages and uses the document total", async () => {
    const source = await blankPdf(2)
    const output = await annotatePdf(
      source.buffer,
      baseOptions({ number: { ...baseOptions({}).number, format: "number-total" } }),
    )
    const pages = await extractPdfText(output)

    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain("1 / 2")
    expect(pages[1]).toContain("2 / 2")
  })

  it("keeps page rotation while annotating rotated pages", async () => {
    const source = await PDFDocument.create()

    for (const rotation of [0, 90, 180, 270]) {
      const page = source.addPage([400, 500])

      page.setRotation(degrees(rotation))
    }

    const bytes = await source.save()
    const output = await annotatePdf(bytes.slice().buffer, baseOptions({ pages: [1, 2, 3, 4] }))
    const annotated = await PDFDocument.load(output)
    const pages = await extractPdfText(output)

    expect(annotated.getPages().map((page) => page.getRotation().angle)).toEqual([0, 90, 180, 270])
    expect(pages[0]).toContain("1")
    expect(pages[3]).toContain("4")
  })

  it("adds a text watermark only to the selected page", async () => {
    const source = await blankPdf(2)
    const output = await annotatePdf(
      source.buffer,
      baseOptions({
        mode: "watermark",
        pages: [2],
        watermark: {
          kind: "text",
          text: "CONFIDENTIAL",
          placement: "single",
          opacity: 25,
          rotation: -45,
          fontSize: 32,
          scale: 35,
        },
      }),
    )
    const pages = await extractPdfText(output)

    expect(pages[0]).not.toContain("CONFIDENTIAL")
    expect(pages[1]).toContain("CONFIDENTIAL")
  })
})
