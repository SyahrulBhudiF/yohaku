import { MAX_QR_IMAGE_PIXELS } from "@/libs/schemas/qr"

// jsQR is O(pixels); a 24 MP photo is needlessly slow. QR modules stay
// readable at this side, and the canvas copy stays small.
const MAX_SCAN_SIDE = 2_048

interface ScanRequest {
  readonly file: File
}

type ScanResponse =
  | { readonly ok: true; readonly data: string }
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

    if (bitmap.width * bitmap.height > MAX_QR_IMAGE_PIXELS) {
      scope.postMessage({ ok: false, code: "too-large" })

      return
    }

    const source = bitmap
    const scale = Math.min(1, MAX_SCAN_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const jsQR = await import("jsqr")
    const decodeAt = (targetWidth: number, targetHeight: number) => {
      const canvas = new OffscreenCanvas(targetWidth, targetHeight)
      const context = canvas.getContext("2d", { willReadFrequently: true })

      if (!context) {
        return null
      }

      context.drawImage(source, 0, 0, targetWidth, targetHeight)
      const image = context.getImageData(0, 0, targetWidth, targetHeight)

      return (
        jsQR.default(image.data, image.width, image.height, {
          inversionAttempts: "attemptBoth",
        })?.data ?? null
      )
    }
    const decoded =
      decodeAt(width, height) ?? (scale < 1 ? decodeAt(source.width, source.height) : null)

    if (!decoded) {
      scope.postMessage({ ok: false, code: "no-code" })

      return
    }

    scope.postMessage({ ok: true, data: decoded })
  } catch {
    scope.postMessage({ ok: false, code: "unreadable" })
  } finally {
    bitmap?.close()
  }
}
