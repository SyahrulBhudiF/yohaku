import jsQR from "jsqr"
import QRCode from "qrcode"
import { describe, expect, it, vi } from "vitest"

import { scanQrCodeImage, generateQrCode } from "@/features/qr-code/process"
import { MAX_QR_TEXT_BYTES } from "@/libs/schemas/qr"

const matrixToRgba = (matrix: ReturnType<typeof QRCode.create>) => {
  const quietZone = 4
  const width = matrix.modules.size + quietZone * 2
  const pixels = new Uint8ClampedArray(width * width * 4)

  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const moduleX = x - quietZone
      const moduleY = y - quietZone
      const dark =
        moduleX >= 0 &&
        moduleY >= 0 &&
        moduleX < matrix.modules.size &&
        moduleY < matrix.modules.size &&
        matrix.modules.get(moduleY, moduleX) === 1
      const offset = (y * width + x) * 4
      const color = dark ? 0 : 255

      pixels[offset] = color
      pixels[offset + 1] = color
      pixels[offset + 2] = color
      pixels[offset + 3] = 255
    }
  }

  return { pixels, width }
}

describe("QR code feature process", () => {
  it("generates a PNG QR code that jsqr can decode", async () => {
    const text = "https://example.com/qr?source=yohaku"
    const generated = await generateQrCode({ text, format: "png" })
    const matrix = QRCode.create(text)
    const image = matrixToRgba(matrix)
    const decoded = jsQR(image.pixels, image.width, image.width)

    expect(generated.dataUrl).toMatch(/^data:image\/png;base64,/)
    expect(generated.fileName).toBe("yohaku-qr-code.png")
    expect(decoded?.data).toBe(text)
  })

  it("generates an SVG image data URL", async () => {
    const generated = await generateQrCode({ text: "hello", format: "svg" })

    expect(generated.dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(generated.fileName).toBe("yohaku-qr-code.svg")
  })

  it("rejects empty and oversized QR content", async () => {
    await expect(generateQrCode({ text: "   ", format: "png" })).rejects.toThrow(
      "Enter some text or a URL",
    )
    await expect(
      generateQrCode({ text: "é".repeat(MAX_QR_TEXT_BYTES), format: "png" }),
    ).rejects.toThrow("UTF-8 bytes")
  })

  it("reports unsupported and unreadable image files", async () => {
    const unsupported = new File(["not an image"], "notes.txt", { type: "text/plain" })

    await expect(scanQrCodeImage(unsupported)).rejects.toThrow("Choose an image file")

    const tiff = new File([new Uint8Array([0x49, 0x49, 0x2a, 0x00])], "scan.tiff", {
      type: "image/tiff",
    })

    await expect(scanQrCodeImage(tiff)).rejects.toThrow("PNG, JPEG, WebP, AVIF, or GIF")

    class MockWorker {
      onmessage: ((event: { data: { ok: false; code: "unreadable" } }) => void) | null = null
      onerror: (() => void) | null = null

      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { ok: false, code: "unreadable" } }))
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", MockWorker)
    const malformed = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])],
      "broken.png",
      { type: "image/png" },
    )

    await expect(scanQrCodeImage(malformed)).rejects.toThrow("could not be read")
    vi.unstubAllGlobals()
  })
})
