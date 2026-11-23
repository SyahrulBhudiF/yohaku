declare module "gifenc" {
  export interface GifEncoder {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options: { palette: number[][]; delay?: number; repeat?: number },
    ) => void
    finish: () => void
    bytes: () => Uint8Array
  }

  export const GIFEncoder: () => GifEncoder
  export const quantize: (
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: "rgb565" | "rgb444" | "rgba4444" },
  ) => number[][]
  export const applyPalette: (
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444",
  ) => Uint8Array
}

declare module "utif" {
  export interface Ifd {
    width: number
    height: number
    [key: string]: unknown
  }

  export function decode(buffer: ArrayBuffer): Ifd[]
  export function decodeImage(buffer: ArrayBuffer, ifd: Ifd): void
  export function toRGBA8(ifd: Ifd): Uint8Array
  export function encodeImage(
    rgba: Uint8Array,
    width: number,
    height: number,
    metadata?: Record<string, unknown>,
  ): ArrayBuffer

  const UTIF: {
    decode: typeof decode
    decodeImage: typeof decodeImage
    toRGBA8: typeof toRGBA8
    encodeImage: typeof encodeImage
  }

  export default UTIF
}
