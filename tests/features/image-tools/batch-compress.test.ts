import { assert, describe, it } from "@effect/vitest"
import { beforeAll } from "vitest"

import { compressImages } from "@/features/image-tools/batch-process"
import { BatchImageError } from "@/infrastructure/errors/image"
import type { BatchImageInputFile } from "@/libs/schemas/image"
import { initImageCodecs, makePng } from "../../support/image-codecs"

beforeAll(initImageCodecs, 60_000)

const entry = async (id: string, name: string): Promise<BatchImageInputFile> => {
  const bytes = await makePng()

  return {
    id,
    file: new File([bytes], name, { type: "image/png" }),
    name,
    size: bytes.byteLength,
  }
}

describe("batch image compression", () => {
  it("rejects settings outside the Effect Schema contract", async () => {
    const files = [await entry("a", "photo.png")]
    const error = await compressImages({ files, format: "webp", quality: 0 }).then(
      () => null,
      (cause: unknown) => cause,
    )

    assert.ok(error instanceof BatchImageError)
    assert.strictEqual(error.message, "The batch settings are not valid.")
  })

  it("compresses images concurrently and streams a ZIP", async () => {
    const files = [await entry("a", "photo.png"), await entry("b", "photo.png")]
    const result = await compressImages({ files, format: "webp", quality: 60 })
    const bytes = new Uint8Array(await result.blob.arrayBuffer())

    assert.strictEqual(result.items.length, 2)
    assert.strictEqual(result.failures.length, 0)
    assert.strictEqual(result.items[0]?.fileName, "photo-compressed.webp")
    assert.strictEqual(result.items[1]?.fileName, "photo-compressed-2.webp")
    assert.strictEqual(result.fileName, "compressed-images.zip")
    assert.strictEqual(bytes[0], 0x50)
    assert.strictEqual(bytes[1], 0x4b)
  })
})
