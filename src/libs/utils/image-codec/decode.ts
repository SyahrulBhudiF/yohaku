import type { ImageInputFormat } from "@/libs/schemas/image"
import { decodeGif } from "./gif"
import { decodeTiff } from "./tiff"
import { decodeWebpAnimation, isAnimatedWebp } from "./webp-animation"

type Decoder = (buffer: ArrayBuffer) => Promise<ImageData | null>

const toArrayBuffer = (input: Uint8Array): ArrayBuffer =>
  input.byteOffset === 0 && input.byteLength === input.buffer.byteLength
    ? (input.buffer as ArrayBuffer)
    : (input.slice().buffer as ArrayBuffer)

let nativeHeicSupport: boolean | undefined

const decodeHeicNatively = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  if (nativeHeicSupport === false || typeof createImageBitmap !== "function") {
    return null
  }

  try {
    const bitmap = await createImageBitmap(new Blob([buffer], { type: "image/heic" }))

    try {
      if (typeof OffscreenCanvas === "undefined") {
        return null
      }

      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext("2d")

      if (!context) {
        return null
      }

      nativeHeicSupport = true
      context.drawImage(bitmap, 0, 0)

      return context.getImageData(0, 0, bitmap.width, bitmap.height)
    } finally {
      bitmap.close()
    }
  } catch {
    nativeHeicSupport = false

    return null
  }
}

const toImageData = (image: {
  readonly data: Uint8Array | Uint8ClampedArray
  readonly width: number
  readonly height: number
}) => {
  const pixels =
    image.data instanceof Uint8ClampedArray
      ? image.data
      : new Uint8ClampedArray(
          image.data.buffer as ArrayBuffer,
          image.data.byteOffset,
          image.data.byteLength,
        )

  return new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, image.width, image.height)
}

const findPitm = (bytes: Uint8Array): number | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const readType = (offset: number) =>
    String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!)
  const walk = (start: number, end: number): number | null => {
    let offset = start

    while (offset + 8 <= end) {
      const size = view.getUint32(offset)
      const type = readType(offset + 4)
      let boxSize = size
      let header = 8

      if (size === 1) {
        if (offset + 16 > end) return null

        boxSize = view.getUint32(offset + 8) * 4294967296 + view.getUint32(offset + 12)
        header = 16
      } else if (size === 0) {
        boxSize = end - offset
      }

      if (boxSize < header || offset + boxSize > end) return null
      if (type === "pitm") return offset + header

      if (type === "meta") {
        const found = walk(offset + header + 4, offset + boxSize)

        if (found !== null) return found
      }

      offset += boxSize
    }

    return null
  }

  return walk(0, bytes.length)
}

const decodeHeicFallback = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  const bytes = new Uint8Array(buffer)

  try {
    const { decodeHeic: decode } = await import("@stacksjs/ts-heic")

    return toImageData(decode(bytes))
  } catch {
    const { decode } = await import("heif-js/heic")

    return toImageData(decode(bytes))
  }
}

/** Repoints pitm at the embedded thumbnail item so heif-js decodes only that item. */
const decodeHeicThumbnail = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  try {
    const bytes = new Uint8Array(buffer)
    const { HeifFile } = await import("heif-js/detect")
    const file = new HeifFile().parse(bytes)
    const primary = file.primary
    const thumbnail = [...file.items.values()].find((item) =>
      item.references.thmb?.includes(file.primaryItemId),
    )

    if (!thumbnail) {
      return null
    }

    const pitm = findPitm(bytes)

    if (pitm === null) {
      return null
    }

    const patched = bytes.slice()
    const view = new DataView(patched.buffer)

    if (patched[pitm] === 0) {
      view.setUint16(pitm + 4, thumbnail.itemId)
    } else {
      view.setUint32(pitm + 4, thumbnail.itemId)
    }

    const { decode } = await import("heif-js/heic")
    const image = decode(patched)
    const primaryAspect =
      primary.irot % 2 === 0 ? primary.width / primary.height : primary.height / primary.width

    if (Math.abs(image.width / image.height - primaryAspect) > 0.01) {
      return null
    }

    return toImageData(image)
  } catch {
    return null
  }
}

// Both decoders are MIT and run in the image worker. ts-heic matches libheif
// closely for typical 8-bit 4:2:0 iPhone files; heif-js covers wider profiles.
const decodeHeic = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  const native = await decodeHeicNatively(buffer)

  if (native) {
    return native
  }

  return decodeHeicFallback(buffer)
}

/** Previews use the embedded thumbnail when present, then fall back to a full decode. */
export const decodeHeicPreview = async (input: Uint8Array): Promise<ImageData | null> => {
  const buffer = toArrayBuffer(input)
  const native = await decodeHeicNatively(buffer)

  if (native) {
    return native
  }

  const thumbnail = await decodeHeicThumbnail(buffer)

  if (thumbnail) {
    return thumbnail
  }

  return decodeHeicFallback(buffer)
}

/** Reads HEIC dimensions from container metadata without decoding pixels. */
export const measureHeic = async (input: Uint8Array) => {
  const { getHeicMetadata } = await import("@stacksjs/ts-heic")
  const metadata = getHeicMetadata(input)
  const swap = metadata.rotation % 2 !== 0

  return {
    width: swap ? metadata.height : metadata.width,
    height: swap ? metadata.width : metadata.height,
  }
}

const decoders: Record<ImageInputFormat, Decoder> = {
  png: async (buffer) => (await import("@jsquash/png/decode")).default(buffer),
  jpeg: async (buffer) =>
    (await import("@jsquash/jpeg/decode")).default(buffer, { preserveOrientation: true }),
  webp: async (buffer) => {
    const bytes = new Uint8Array(buffer)

    // libwebp's simple decoder rejects animated files, so take the first
    // composited frame from the animation decoder for still outputs.
    if (isAnimatedWebp(bytes)) {
      const animation = await decodeWebpAnimation(bytes)

      return animation?.frames[0]?.image ?? null
    }

    return (await import("@jsquash/webp/decode")).default(buffer)
  },
  avif: async (buffer) => (await import("@jsquash/avif/decode")).default(buffer),
  gif: decodeGif,
  tiff: decodeTiff,
  heic: decodeHeic,
}

export const decodeImage = (input: Uint8Array, format: ImageInputFormat) =>
  decoders[format](toArrayBuffer(input))
