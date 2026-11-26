import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { detectImageFormat, detectImageInputFormat } from "@/libs/utils/image-codec"

const brandFile = (...brands: ReadonlyArray<string>) => {
  const bytes = new Uint8Array(8 + brands.length * 4)
  const view = new DataView(bytes.buffer)

  view.setUint32(0, bytes.length)
  bytes.set([0x66, 0x74, 0x79, 0x70], 4)
  brands.forEach((brand, index) => {
    bytes.set(new TextEncoder().encode(brand), 8 + index * 4)
  })

  return bytes
}

describe("image input format detection", () => {
  it("recognizes HEIC as input without exposing it as an output format", () => {
    const bytes = brandFile("heic")

    expect(detectImageInputFormat(bytes)).toBe("heic")
    expect(detectImageFormat(bytes)).toBeNull()
  })

  it("prefers AVIF when generic HEIF brands are also present", () => {
    expect(detectImageInputFormat(brandFile("mif1", "avif"))).toBe("avif")
    expect(detectImageInputFormat(brandFile("avis"))).toBe("avif")
  })

  it("does not classify unrelated ISO-BMFF brands as images", () => {
    expect(detectImageInputFormat(brandFile("isom"))).toBeNull()
  })

  it("recognizes a real HEIC container", () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../../support/fixtures/sample.heic", import.meta.url)),
    )

    expect(detectImageInputFormat(bytes)).toBe("heic")
  })
})
