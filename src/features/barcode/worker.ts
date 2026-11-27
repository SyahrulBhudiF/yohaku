import { MAX_BARCODE_IMAGE_PIXELS } from "@/libs/schemas/barcode"

// ZXing is O(pixels); cap the first pass and retry at full size only when
// the barcode was too small in the downscaled copy.
const MAX_SCAN_SIDE = 2_048

interface ScanRequest {
  readonly file: File
}

type ScanResponse =
  | { readonly ok: true; readonly format: string; readonly text: string }
  | {
      readonly ok: false
      readonly code: "too-large" | "unreadable" | "no-code"
    }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ScanRequest>) => void) | null
  postMessage: (message: ScanResponse) => void
}

scope.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined

  try {
    bitmap = await createImageBitmap(data.file)

    if (bitmap.width * bitmap.height > MAX_BARCODE_IMAGE_PIXELS) {
      scope.postMessage({ ok: false, code: "too-large" })

      return
    }

    const source = bitmap
    const scale = Math.min(1, MAX_SCAN_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const zxing = await import("@zxing/library")
    const hints = new Map<number, unknown>()

    hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
      zxing.BarcodeFormat.CODE_128,
      zxing.BarcodeFormat.EAN_13,
      zxing.BarcodeFormat.UPC_A,
    ])
    hints.set(zxing.DecodeHintType.TRY_HARDER, true)

    const decodeAt = (targetWidth: number, targetHeight: number) => {
      const canvas = new OffscreenCanvas(targetWidth, targetHeight)
      const context = canvas.getContext("2d", { willReadFrequently: true })

      if (!context) return null

      context.drawImage(source, 0, 0, targetWidth, targetHeight)
      const image = context.getImageData(0, 0, targetWidth, targetHeight)
      // RGBLuminanceSource treats a Uint8ClampedArray as luminance, not RGBA.
      // Convert to packed ARGB so its built-in green-weighted conversion runs.
      const pixels = new Int32Array(image.width * image.height)

      for (let index = 0, offset = 0; index < pixels.length; index += 1, offset += 4) {
        pixels[index] =
          ((image.data[offset] ?? 0) << 16) |
          ((image.data[offset + 1] ?? 0) << 8) |
          (image.data[offset + 2] ?? 0)
      }

      const reader = new zxing.MultiFormatReader()

      reader.setHints(hints)

      try {
        const result = reader.decode(
          new zxing.BinaryBitmap(
            new zxing.HybridBinarizer(
              new zxing.RGBLuminanceSource(pixels, image.width, image.height),
            ),
          ),
        )
        const format = result.getBarcodeFormat()
        const label =
          format === zxing.BarcodeFormat.CODE_128
            ? "Code 128"
            : format === zxing.BarcodeFormat.EAN_13
              ? "EAN-13"
              : format === zxing.BarcodeFormat.UPC_A
                ? "UPC-A"
                : "Barcode"

        return { format: label, text: result.getText() }
      } catch {
        return null
      }
    }
    const decoded =
      decodeAt(width, height) ?? (scale < 1 ? decodeAt(source.width, source.height) : null)

    if (!decoded) {
      scope.postMessage({ ok: false, code: "no-code" })

      return
    }

    scope.postMessage({ ok: true, ...decoded })
  } catch {
    scope.postMessage({ ok: false, code: "unreadable" })
  } finally {
    bitmap?.close()
  }
}
