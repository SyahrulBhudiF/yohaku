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
})
