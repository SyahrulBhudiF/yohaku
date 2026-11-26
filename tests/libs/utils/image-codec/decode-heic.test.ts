import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import "../../../support/image-codecs"
import { decodeHeicPreview, decodeImage, measureHeic } from "@/libs/utils/image-codec/decode"

describe("HEIC decoding", () => {
  it("measures a real HEIC from container metadata", async () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../../support/fixtures/sample.heic", import.meta.url)),
    )

    expect(await measureHeic(bytes)).toEqual({ width: 160, height: 120 })
  })

  it("decodes a real HEIC container to RGBA pixels", async () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../../support/fixtures/sample.heic", import.meta.url)),
    )
    const image = await decodeImage(bytes, "heic")

    expect(image).not.toBeNull()

    if (!image) return

    expect(image.width).toBe(160)
    expect(image.height).toBe(120)
    expect(image.data.length).toBe(160 * 120 * 4)
    expect(Math.abs(image.data[0]! - 46)).toBeLessThanOrEqual(2)
    expect(Math.abs(image.data[1]! - 111)).toBeLessThanOrEqual(2)
    expect(Math.abs(image.data[2]! - 77)).toBeLessThanOrEqual(2)
    expect(image.data[3]).toBe(255)
  })

  it("decodes a HEIC preview through the fallback path", async () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../../support/fixtures/sample.heic", import.meta.url)),
    )
    const image = await decodeHeicPreview(bytes)

    expect(image?.width).toBe(160)
    expect(image?.height).toBe(120)
  })
})
