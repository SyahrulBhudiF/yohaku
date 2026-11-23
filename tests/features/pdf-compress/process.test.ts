import { describe, expect, it } from "vitest"

import { compressPdfFile } from "@/features/pdf-compress/process"
import { fixtureFile } from "../../support/pdf"

describe("compressPdfFile", () => {
  it("losslessly optimizes a PDF and reports the byte sizes", async () => {
    const file = await fixtureFile("a.pdf")
    const result = await compressPdfFile({ file })
    const { extractPdfText } = await import("../../support/pdf")

    expect(result.fileName).toBe("a-compressed.pdf")
    expect(result.inputBytes).toBe(file.size)
    expect(result.outputBytes).toBe(result.blob.size)
    expect(result.pages).toBe(3)
    expect(result.blob.type).toBe("application/pdf")
    expect(await extractPdfText(new Uint8Array(await result.blob.arrayBuffer()))).toEqual([
      "a page 1",
      "a page 2",
      "a page 3",
    ])
  })

  it("maps an incorrect password to a tagged password error", async () => {
    const file = await fixtureFile("enc.pdf")

    await expect(compressPdfFile({ file, password: "wrong" })).rejects.toHaveProperty(
      "name",
      "PdfPasswordError",
    )
  })

  it("rejects non-PDF input before starting qpdf", async () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" })

    await expect(compressPdfFile({ file })).rejects.toMatchObject({
      _tag: "PdfInvalidFileError",
      message: "Choose a PDF file.",
    })
  })
})
