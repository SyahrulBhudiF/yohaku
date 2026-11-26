import { readFileSync } from "node:fs"

import { assert, describe, it } from "@effect/vitest"
import { beforeAll } from "vitest"

import { processImage, prepareImageFiles } from "@/features/image-tools/process"
import { initImageCodecs, makePng } from "../../support/image-codecs"

beforeAll(initImageCodecs, 60_000)

describe("processImage", () => {
  it("names the converted file after the chosen format", async () => {
    const file = new File([await makePng()], "photo.png", { type: "image/png" })
    const result = await processImage({ mode: "convert", file, format: "webp", quality: 80 })

    assert.strictEqual(result.fileName, "photo.webp")
    assert.strictEqual(result.mimeType, "image/webp")
    assert.strictEqual(result.originalBytes, file.size)
    assert.strictEqual(result.resultBytes, result.blob.size)
  })

  it("keeps the source format and marks compressed files", async () => {
    const file = new File([await makePng()], "photo.png", { type: "image/png" })
    const result = await processImage({ mode: "compress", file, format: undefined, quality: 60 })

    assert.strictEqual(result.fileName, "photo-compressed.png")
    assert.strictEqual(result.mimeType, "image/png")
    assert.isAtMost(result.resultBytes, result.originalBytes)
  })

  it("losslessly shrinks a palette PNG instead of expanding it to RGBA", async () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../support/fixtures/palette.png", import.meta.url)),
    )
    const file = new File([bytes], "palette.png", { type: "image/png" })
    const result = await processImage({ mode: "compress", file, format: undefined, quality: 20 })

    assert.strictEqual(result.fileName, "palette-compressed.png")
    assert.isBelow(result.resultBytes, bytes.byteLength)
  })

  it("keeps an already optimized file instead of inflating it", async () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../support/fixtures/palette-optimized.png", import.meta.url)),
    )
    const file = new File([bytes], "palette.png", { type: "image/png" })
    const result = await processImage({ mode: "compress", file, format: undefined, quality: 20 })

    assert.strictEqual(result.fileName, "palette-compressed.png")
    assert.strictEqual(result.resultBytes, bytes.byteLength)
    assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes)
  })

  it("accepts readable images and reports unreadable files", async () => {
    const image = new File([await makePng()], "photo.png", { type: "image/png" })
    const text = new File(["not an image"], "notes.txt", { type: "text/plain" })
    const result = await prepareImageFiles({
      files: [image, text],
      existingFileCount: 0,
      existingTotalBytes: 0,
    })

    assert.deepEqual(
      result.accepted.map((file) => file.name),
      ["photo.png"],
    )
    assert.deepEqual(result.errors, ["notes.txt is not a readable image."])
  })

  it("accepts HEIC input by its ISO-BMFF brand", async () => {
    const header = new Uint8Array(12)
    const view = new DataView(header.buffer)

    view.setUint32(0, header.length)
    header.set(new TextEncoder().encode("ftyp"), 4)
    header.set(new TextEncoder().encode("heic"), 8)

    const file = new File([header], "photo.heic", { type: "image/heic" })
    const result = await prepareImageFiles({
      files: [file],
      existingFileCount: 0,
      existingTotalBytes: 0,
    })

    assert.deepEqual(result.accepted, [file])
    assert.deepEqual(result.errors, [])
  })
})
