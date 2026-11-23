import { assert, describe, it } from "@effect/vitest"
import { unzipSync } from "fflate"
import { beforeAll } from "vitest"

import { processImagesToPdf } from "@/features/image-tools/process"
import type { ImagePdfFileEntry } from "@/features/image-tools/store"
import { initImageCodecs, makePng } from "../../support/image-codecs"

beforeAll(initImageCodecs, 60_000)

const makeEntry = async (name: string, width = 120, height = 80): Promise<ImagePdfFileEntry> => {
  const data = await makePng(width, height)
  const file = new File([data], name, { type: "image/png" })

  return { id: name, file, name, size: file.size, previewUrl: "" }
}

const loadPdf = async (data: Uint8Array) => {
  const { PDFDocument } = await import("pdf-lib")

  return PDFDocument.load(data)
}

describe("processImagesToPdf", () => {
  it("combines images into one PDF in order", async () => {
    const landscape = await makeEntry("landscape.png", 120, 80)
    const portrait = await makeEntry("portrait.png", 80, 120)
    const output = await processImagesToPdf({
      files: [landscape, portrait],
      mode: "one",
      pageSize: "fit",
      quality: 90,
    })
    const document = await loadPdf(new Uint8Array(await output.blob.arrayBuffer()))

    assert.strictEqual(output.blob.type, "application/pdf")
    assert.strictEqual(output.pdfs, 1)
    assert.strictEqual(document.getPageCount(), 2)
    assert.closeTo(document.getPage(0).getWidth(), 842, 0.5)
    assert.closeTo(document.getPage(1).getHeight(), 842, 0.5)
  })

  it("makes one PDF per image and zips them", async () => {
    const first = await makeEntry("same.png")
    const second = await makeEntry("same.png")
    const output = await processImagesToPdf({
      files: [first, second],
      mode: "separate",
      pageSize: "fit",
      quality: 90,
    })
    const zip = unzipSync(new Uint8Array(await output.blob.arrayBuffer()))

    assert.strictEqual(output.blob.type, "application/zip")
    assert.strictEqual(output.pdfs, 2)
    assert.deepEqual(Object.keys(zip).sort(), ["same-2.pdf", "same.pdf"])

    for (const data of Object.values(zip)) {
      const document = await loadPdf(data)

      assert.strictEqual(document.getPageCount(), 1)
    }
  })

  it("returns a single PDF without a ZIP for one image", async () => {
    const entry = await makeEntry("one.png")
    const output = await processImagesToPdf({
      files: [entry],
      mode: "separate",
      pageSize: "a4",
      quality: 90,
    })

    assert.strictEqual(output.blob.type, "application/pdf")
    assert.strictEqual(output.fileName, "one.pdf")
    assert.strictEqual(output.pdfs, 1)
  })

  it("embeds an upright JPEG", async () => {
    const encode = (await import("@jsquash/jpeg/encode")).default
    const pixels = new Uint8ClampedArray(80 * 60 * 4).fill(180)
    const jpeg = new Uint8Array(await encode(new ImageData(pixels, 80, 60), { quality: 90 }))
    const file = new File([jpeg], "photo.jpg", { type: "image/jpeg" })
    const output = await processImagesToPdf({
      files: [{ id: "photo", file, name: file.name, size: file.size, previewUrl: "" }],
      mode: "one",
      pageSize: "fit",
      quality: 90,
    })
    const document = await loadPdf(new Uint8Array(await output.blob.arrayBuffer()))

    assert.strictEqual(document.getPageCount(), 1)
  })

  it("rejects a file that is not an image", async () => {
    const file = new File([new TextEncoder().encode("not an image")], "bad.txt", {
      type: "text/plain",
    })

    const error = await processImagesToPdf({
      files: [{ id: "bad", file, name: file.name, size: file.size, previewUrl: "" }],
      mode: "one",
      pageSize: "fit",
      quality: 90,
    }).then(
      () => null,
      (cause: { readonly message?: string }) => cause,
    )

    assert.isNotNull(error)
    assert.isTrue((error.message ?? "").includes("not a readable image"))
  })
})
