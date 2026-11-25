import { assert, describe, it } from "@effect/vitest"
import { beforeAll } from "vitest"

import { resizeImage } from "@/features/image-tools/resize-process"
import { initImageCodecs, makePng } from "../../support/image-codecs"

beforeAll(initImageCodecs, 60_000)

describe("resizeImage", () => {
  it("resizes a PNG and reports the output dimensions", async () => {
    const file = new File([await makePng(120, 80)], "photo.png", { type: "image/png" })
    const result = await resizeImage({
      file,
      options: {
        width: 60,
        height: 40,
        mode: "stretch",
        crop: { x: 0, y: 0, width: 1, height: 1 },
        rotate: 0,
        flipX: false,
        flipY: false,
      },
      format: "png",
      quality: 90,
    })
    const bytes = new Uint8Array(await result.blob.arrayBuffer())

    assert.strictEqual(result.width, 60)
    assert.strictEqual(result.height, 40)
    assert.strictEqual(result.fileName, "photo-60x40.png")
    assert.strictEqual(result.mimeType, "image/png")
    assert.deepEqual(
      Array.from(bytes.slice(0, 8)),
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    )
  })

  it("keeps the source format when asked to keep the original", async () => {
    const file = new File([await makePng(40, 20)], "photo.png", { type: "image/png" })
    const result = await resizeImage({
      file,
      options: {
        width: 20,
        height: 20,
        mode: "fit",
        crop: { x: 0, y: 0, width: 1, height: 1 },
        rotate: 0,
        flipX: false,
        flipY: false,
      },
      format: "original",
      quality: 80,
    })

    assert.strictEqual(result.mimeType, "image/png")
    assert.strictEqual(result.width, 20)
    assert.strictEqual(result.height, 10)
  })
})
