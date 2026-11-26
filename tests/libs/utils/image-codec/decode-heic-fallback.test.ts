import { readFileSync } from "node:fs"

import { describe, expect, it, vi } from "vitest"

vi.mock("@stacksjs/ts-heic", () => ({
  decodeHeic: () => {
    throw new Error("Unsupported HEIC profile")
  },
}))

import "../../../support/image-codecs"
import { decodeImage } from "@/libs/utils/image-codec/decode"

describe("HEIC decoding fallback", () => {
  it("uses the wider-profile decoder when the primary decoder rejects the file", async () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../../support/fixtures/sample.heic", import.meta.url)),
    )
    const image = await decodeImage(bytes, "heic")

    expect(image).not.toBeNull()

    if (!image) return

    expect(image.width).toBe(160)
    expect(image.height).toBe(120)
    expect(image.data.length).toBe(160 * 120 * 4)
    expect(Math.abs(image.data[0]! - 46)).toBeLessThanOrEqual(4)
    expect(image.data[3]).toBe(255)
  })
})
