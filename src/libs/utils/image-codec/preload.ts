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

/**
 * Warm the encoder a user is about to need, so the first conversion does not
 * wait on a several-megabyte wasm download and compile.
 */
export const warmImageCodec = async (format: ImageFormat): Promise<void> => {
  await encoders[format]().catch(() => undefined)
}
