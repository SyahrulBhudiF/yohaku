import { describe, expect, it } from "vitest"

import { normalizeBarcodeValue } from "@/features/barcode/validation"

describe("barcode value validation", () => {
  it("keeps printable Code 128 values and rejects unsupported text", () => {
    expect(normalizeBarcodeValue("code128", " YOHaku-2026 ")).toEqual({
      ok: true,
      value: "YOHaku-2026",
    })
    expect(normalizeBarcodeValue("code128", "")).toMatchObject({ ok: false })
    expect(normalizeBarcodeValue("code128", "line\nbreak")).toMatchObject({ ok: false })
    expect(normalizeBarcodeValue("code128", "x".repeat(129))).toMatchObject({ ok: false })
  })

  it("adds the EAN-13 check digit and preserves leading zeros", () => {
    expect(normalizeBarcodeValue("ean13", "490123456789")).toEqual({
      ok: true,
      value: "4901234567894",
    })
    expect(normalizeBarcodeValue("ean13", "012345678912")).toEqual({
      ok: true,
      value: "0123456789128",
    })
    expect(normalizeBarcodeValue("ean13", "4901234567894")).toEqual({
      ok: true,
      value: "4901234567894",
    })
  })

  it("rejects an invalid EAN-13 check digit", () => {
    expect(normalizeBarcodeValue("ean13", "4901234567890")).toEqual({
      ok: false,
      message: expect.stringContaining("check digit"),
    })
  })

  it("adds the UPC-A check digit and rejects an invalid one", () => {
    expect(normalizeBarcodeValue("upca", "03600029145")).toEqual({
      ok: true,
      value: "036000291452",
    })
    expect(normalizeBarcodeValue("upca", "036000291452")).toEqual({
      ok: true,
      value: "036000291452",
    })
    expect(normalizeBarcodeValue("upca", "036000291450")).toEqual({
      ok: false,
      message: expect.stringContaining("check digit"),
    })
  })

  it("rejects the wrong digit count and non-digits for retail formats", () => {
    expect(normalizeBarcodeValue("ean13", "12345")).toMatchObject({ ok: false })
    expect(normalizeBarcodeValue("ean13", "49012345678A")).toMatchObject({ ok: false })
    expect(normalizeBarcodeValue("upca", "12345")).toMatchObject({ ok: false })
  })
})
