import { assert, describe, it } from "@effect/vitest"
import { decodePDFRawStream, degrees, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib"
import { expect } from "vitest"

import { signPdf, type SignaturePlacement } from "@/features/pdf-sign/process"

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=",
    "base64",
  ),
)

const contents = (document: PDFDocument, pageIndex: number) => {
  const page = document.getPage(pageIndex)
  const streams = page.node.Contents()
  const objects = streams instanceof PDFArray ? streams.asArray() : [streams]

  return objects
    .map((object) => document.context.lookup(object))
    .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
    .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()))
    .join("\n")
}

describe("signPdf", () => {
  it("preserves pages and places multiple overlays in the displayed crop box at every rotation", async () => {
    const input = await PDFDocument.create()

    for (const angle of [0, 90, 180, 270]) {
      const page = input.addPage([600, 800])

      page.setCropBox(100, 200, 300, 400)
      page.setRotation(degrees(angle))
      page.drawText(`original ${angle}`, { x: 120, y: 250 })
    }

    const placement: Omit<SignaturePlacement, "page"> = {
      png,
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.1,
    }
    const file = new File([Uint8Array.from(await input.save())], "input.pdf", {
      type: "application/pdf",
    })
    const output = await signPdf(file, [
      ...[1, 2, 3, 4].map((page) => ({ ...placement, page })),
      { ...placement, page: 1, x: 0.5 },
    ])
    const document = await PDFDocument.load(await output.arrayBuffer())

    assert.strictEqual(output.type, "application/pdf")
    assert.strictEqual(document.getPageCount(), 4)
    const expected = [
      [130, 480, 90, 40],
      [190, 240, 120, 30],
      [370, 320, 90, 40],
      [310, 560, 120, 30],
    ]

    for (const [index, [x, y, width, height]] of expected.entries()) {
      const page = document.getPage(index)
      const stream = contents(document, index)
      const angle = (index * Math.PI) / 2
      const rotation = (stream.split(`1 0 0 1 ${x} ${y} cm\n`)[1] ?? "").split("\n")[0] ?? ""
      const matrix = rotation.split(" ").slice(0, 4).map(Number)

      assert.deepEqual(page.getCropBox(), { x: 100, y: 200, width: 300, height: 400 })
      assert.strictEqual(page.getRotation().angle, index * 90)
      assert.include(stream, "BT")
      assert.include(stream, `1 0 0 1 ${x} ${y} cm`)
      assert.include(stream, `${width} 0 0 ${height} 0 0 cm`)

      for (const [valueIndex, value] of [
        Math.cos(angle),
        Math.sin(angle),
        -Math.sin(angle),
        Math.cos(angle),
      ].entries()) {
        assert.closeTo(matrix[valueIndex] ?? NaN, value, 1e-10)
      }

      assert.strictEqual((stream.match(/ Do\b/g) ?? []).length, index === 0 ? 2 : 1)
    }

    assert.include(contents(document, 0), "1 0 0 1 250 480 cm")
  })

  it("rejects invalid input and placements with tagged errors", async () => {
    const document = await PDFDocument.create()

    document.addPage()
    const file = new File([Uint8Array.from(await document.save())], "input.pdf")
    const placement = { page: 1, png, x: 0, y: 0, width: 0.2, height: 0.2 }

    for (const invalid of [
      { ...placement, page: 0 },
      { ...placement, page: 2 },
      { ...placement, width: 0 },
      { ...placement, x: 0.9 },
      { ...placement, y: Number.NaN },
      { ...placement, png: new Uint8Array([1, 2]) },
    ]) {
      await expect(signPdf(file, [invalid])).rejects.toMatchObject({ _tag: "PdfProcessingError" })
    }

    await expect(signPdf(new File(["not a pdf"], "bad.pdf"), [])).rejects.toMatchObject({
      _tag: "PdfProcessingError",
    })
  })
})
