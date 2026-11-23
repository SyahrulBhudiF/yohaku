import type { ImageFormat } from "@/libs/schemas/image"
import { encodeGif } from "./gif"
import { encodeTiff } from "./tiff"

type Encoder = (image: ImageData, quality: number) => Promise<Uint8Array<ArrayBuffer>>

const encoders: Record<ImageFormat, Encoder> = {
  png: async (image) => new Uint8Array(await (await import("@jsquash/png/encode")).default(image)),
  // Baseline halves encode time; progressive scan optimization buys ~1%
  // smaller files for twice the CPU.
  jpeg: async (image, quality) =>
    new Uint8Array(
      await (
        await import("@jsquash/jpeg/encode")
      ).default(image, {
        quality,
        progressive: false,
      }),
    ),
  // `method` is libwebp's effort level. 2 encodes ~2x faster than the default 4
  // with no meaningful size change at this quality.
  webp: async (image, quality) =>
    new Uint8Array(
      await (await import("@jsquash/webp/encode")).default(image, { quality, method: 2 }),
    ),
  // `speed` trades size for time: the default 6 spends seconds on a 1.5 MP
  // image, while 9 finishes in ~200 ms for roughly 2% larger output.
  avif: async (image, quality) =>
    new Uint8Array(
      await (await import("@jsquash/avif/encode")).default(image, { quality, speed: 9 }),
    ),
  gif: encodeGif,
  tiff: (image) => encodeTiff(image),
}

export const encodeImage = (image: ImageData, format: ImageFormat, quality: number) =>
  encoders[format](image, quality)
