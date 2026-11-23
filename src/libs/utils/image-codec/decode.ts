import type { ImageFormat } from "@/libs/schemas/image"
import { decodeGif } from "./gif"
import { decodeTiff } from "./tiff"

type Decoder = (buffer: ArrayBuffer) => Promise<ImageData | null>

const decoders: Record<ImageFormat, Decoder> = {
  png: async (buffer) => (await import("@jsquash/png/decode")).default(buffer),
  jpeg: async (buffer) =>
    (await import("@jsquash/jpeg/decode")).default(buffer, { preserveOrientation: true }),
  webp: async (buffer) => (await import("@jsquash/webp/decode")).default(buffer),
  avif: async (buffer) => (await import("@jsquash/avif/decode")).default(buffer),
  gif: decodeGif,
  tiff: decodeTiff,
}

const toArrayBuffer = (input: Uint8Array): ArrayBuffer =>
  input.byteOffset === 0 && input.byteLength === input.buffer.byteLength
    ? (input.buffer as ArrayBuffer)
    : (input.slice().buffer as ArrayBuffer)

export const decodeImage = (input: Uint8Array, format: ImageFormat) =>
  decoders[format](toArrayBuffer(input))
