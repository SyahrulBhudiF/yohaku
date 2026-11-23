import type { ImageFormat } from "@/libs/schemas/image"

type Loader = () => Promise<unknown>

const noop = async () => undefined

const encoders: Record<ImageFormat, Loader> = {
  png: () => import("@jsquash/png/encode").then((codec) => codec.init()),
  jpeg: () => import("@jsquash/jpeg/encode").then((codec) => codec.init()),
  webp: () => import("@jsquash/webp/encode").then((codec) => codec.init()),
  avif: () => import("@jsquash/avif/encode").then((codec) => codec.init()),
  gif: noop,
  tiff: noop,
}

const decoders: Record<ImageFormat, Loader> = {
  png: () => import("@jsquash/png/decode").then((codec) => codec.init()),
  jpeg: () => import("@jsquash/jpeg/decode").then((codec) => codec.init()),
  webp: () => import("@jsquash/webp/decode").then((codec) => codec.init()),
  avif: () => import("@jsquash/avif/decode").then((codec) => codec.init()),
  gif: noop,
  tiff: noop,
}

/**
 * Warm the encoder or decoder a user is about to need, so the first
 * conversion does not wait on a several-megabyte wasm download.
 */
export const preloadImageCodec = async (
  format: ImageFormat,
  direction: "decode" | "encode",
): Promise<void> => {
  // Only the browser fetches wasm lazily; Node tests pre-seed compiled modules.
  if (typeof window === "undefined") {
    return
  }

  const loader = direction === "encode" ? encoders[format] : decoders[format]

  await loader().catch(() => undefined)
}
