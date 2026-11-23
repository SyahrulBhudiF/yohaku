import { Context, Effect, Layer } from "effect"

import { ImageProcessingError, UnsupportedFormatError } from "@/infrastructure/errors/image"
import type { ImageFormat } from "@/libs/schemas/image"

export interface ProcessedImage {
  readonly data: Uint8Array<ArrayBuffer>
  readonly format: ImageFormat
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length))

const detect = (input: Uint8Array): ImageFormat | null => {
  const startsWith = (signature: readonly number[], offset = 0) =>
    signature.every((byte, index) => input[offset + index] === byte)

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png"
  }

  if (startsWith([0xff, 0xd8, 0xff])) {
    return "jpeg"
  }

  if (input.length >= 12 && ascii(input, 0, 4) === "RIFF" && ascii(input, 8, 4) === "WEBP") {
    return "webp"
  }

  if (input.length >= 12 && ascii(input, 4, 4) === "ftyp") {
    // AVIF may use `mif1`/`msf1` as the major brand and list `avif`/`avis`
    // among its compatible brands, so scan the whole `ftyp` box.
    const boxSize = ((input[0]! << 24) | (input[1]! << 16) | (input[2]! << 8) | input[3]!) >>> 0
    const end = Math.min(boxSize, input.length)

    for (let offset = 8; offset + 4 <= end; offset += 4) {
      const brand = ascii(input, offset, 4)

      if (brand === "avif" || brand === "avis") {
        return "avif"
      }
    }
  }

  if (ascii(input, 0, 4) === "GIF8") {
    return "gif"
  }

  if (startsWith([0x49, 0x49, 0x2a, 0x00]) || startsWith([0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff"
  }

  return null
}

const toArrayBuffer = (input: Uint8Array): ArrayBuffer =>
  input.byteOffset === 0 && input.byteLength === input.buffer.byteLength
    ? (input.buffer as ArrayBuffer)
    : (input.slice().buffer as ArrayBuffer)

const decodeGif = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  const { decompressFrames, parseGIF } = await import("gifuct-js")
  const gif = parseGIF(buffer)
  const frame = decompressFrames(gif, true)[0]

  if (!frame) {
    return null
  }

  const { width, height } = gif.lsd
  const { left, top, width: frameWidth, height: frameHeight } = frame.dims
  const data = new Uint8ClampedArray(width * height * 4)

  // A single-frame GIF covers the canvas: copy the contiguous patch in one
  // pass instead of walking pixels.
  if (left === 0 && top === 0 && frameWidth === width && frameHeight === height) {
    data.set(frame.patch)

    return new ImageData(data, width, height)
  }

  for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const source = (y * frameWidth + x) * 4
      const alpha = frame.patch[source + 3] ?? 0

      if (alpha === 0) {
        continue
      }

      const target = ((top + y) * width + (left + x)) * 4

      data[target] = frame.patch[source]!
      data[target + 1] = frame.patch[source + 1]!
      data[target + 2] = frame.patch[source + 2]!
      data[target + 3] = alpha
    }
  }

  return new ImageData(data, width, height)
}

const decodeTiff = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  const UTIF = (await import("utif")).default
  const ifd = UTIF.decode(buffer)[0]

  if (!ifd) {
    return null
  }

  UTIF.decodeImage(buffer, ifd)

  return new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(ifd)), ifd.width, ifd.height)
}

const decodeImage = async (buffer: ArrayBuffer, format: ImageFormat): Promise<ImageData | null> => {
  switch (format) {
    case "png":
      return (await import("@jsquash/png/decode")).default(buffer)
    case "jpeg":
      return (await import("@jsquash/jpeg/decode")).default(buffer, { preserveOrientation: true })
    case "webp":
      return (await import("@jsquash/webp/decode")).default(buffer)
    case "avif":
      return (await import("@jsquash/avif/decode")).default(buffer)
    case "gif":
      return decodeGif(buffer)
    case "tiff":
      return decodeTiff(buffer)
  }
}

const decode = (
  input: Uint8Array,
  format: ImageFormat,
): Effect.Effect<ImageData, ImageProcessingError> =>
  Effect.gen(function* () {
    const image = yield* Effect.tryPromise({
      try: () => decodeImage(toArrayBuffer(input), format),
      catch: () => new ImageProcessingError({ message: "Could not read this image." }),
    })

    if (!image) {
      return yield* new ImageProcessingError({ message: `Could not decode ${format}.` })
    }

    return image
  })

const encodeGif = async (image: ImageData, quality: number): Promise<Uint8Array<ArrayBuffer>> => {
  const loaded = await import("gifenc")
  // Vite resolves gifenc's ESM build; Node's CJS interop exposes it on `default`.
  const gifenc =
    typeof loaded.quantize === "function" ? loaded : (loaded.default as unknown as typeof loaded)
  const colors = Math.max(2, Math.min(256, Math.round((quality / 100) * 256)))
  // gifenc reads the typed array's whole backing buffer, so hand it a view
  // that starts at byte 0 and ends at the last pixel.
  const rgba =
    image.data.byteOffset === 0 && image.data.byteLength === image.data.buffer.byteLength
      ? image.data
      : new Uint8ClampedArray(image.data)
  const palette = gifenc.quantize(rgba, colors)
  const index = gifenc.applyPalette(rgba, palette, "rgb565")
  const gif = gifenc.GIFEncoder()

  gif.writeFrame(index, image.width, image.height, { palette })
  gif.finish()

  return gif.bytes() as Uint8Array<ArrayBuffer>
}

const encodeTiff = async (image: ImageData): Promise<Uint8Array<ArrayBuffer>> => {
  const UTIF = (await import("utif")).default
  const rgba = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength)

  return new Uint8Array(UTIF.encodeImage(rgba, image.width, image.height))
}

const encodeImage = async (
  image: ImageData,
  format: ImageFormat,
  quality: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  switch (format) {
    case "png":
      return new Uint8Array(await (await import("@jsquash/png/encode")).default(image))
    case "jpeg":
      // Baseline halves encode time; progressive scan optimization buys ~1%
      // smaller files for twice the CPU.
      return new Uint8Array(
        await (
          await import("@jsquash/jpeg/encode")
        ).default(image, {
          quality,
          progressive: false,
        }),
      )
    case "webp":
      // `method` is libwebp's effort level. 2 encodes ~2x faster than the
      // default 4 with no meaningful size change at this quality.
      return new Uint8Array(
        await (await import("@jsquash/webp/encode")).default(image, { quality, method: 2 }),
      )
    case "avif":
      // `speed` trades size for time: the default 6 spends seconds on a 1.5 MP
      // image, while 9 finishes in ~200 ms for roughly 2% larger output.
      return new Uint8Array(
        await (await import("@jsquash/avif/encode")).default(image, { quality, speed: 9 }),
      )
    case "gif":
      return encodeGif(image, quality)
    case "tiff":
      return encodeTiff(image)
  }
}

const encode = (
  image: ImageData,
  format: ImageFormat,
  quality: number,
): Effect.Effect<Uint8Array<ArrayBuffer>, ImageProcessingError> =>
  Effect.tryPromise({
    try: () => encodeImage(image, format, quality),
    catch: () => new ImageProcessingError({ message: `Could not encode the image as ${format}.` }),
  })

const detectFormat = Effect.fn("ImageProcessor.detectFormat")(function* (input: Uint8Array) {
  const detected = detect(input)

  if (detected === null) {
    return yield* new ImageProcessingError({ message: "The file is not a readable image." })
  }

  return detected
})

export class ImageProcessor extends Context.Service<
  ImageProcessor,
  {
    readonly detectFormat: (
      input: Uint8Array,
    ) => Effect.Effect<ImageFormat, UnsupportedFormatError | ImageProcessingError>
    readonly transcode: (
      input: Uint8Array,
      format: ImageFormat,
      quality: number,
    ) => Effect.Effect<ProcessedImage, ImageProcessingError | UnsupportedFormatError>
  }
>()("tools/ImageProcessor") {
  static readonly layer = Layer.succeed(
    ImageProcessor,
    ImageProcessor.of({
      detectFormat,
      transcode: Effect.fn("ImageProcessor.transcode")(function* (
        input: Uint8Array,
        format: ImageFormat,
        quality: number,
      ) {
        const source = yield* detectFormat(input)
        const image = yield* decode(input, source)
        const data = yield* encode(image, format, quality)

        return { data, format }
      }),
    }),
  )
}

export const detectImageFormat = (input: Uint8Array): ImageFormat | null => detect(input)

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

  const load = async () => {
    switch (`${direction}:${format}`) {
      case "encode:png":
        return (await import("@jsquash/png/encode")).init()
      case "encode:jpeg":
        return (await import("@jsquash/jpeg/encode")).init()
      case "encode:webp":
        return (await import("@jsquash/webp/encode")).init()
      case "encode:avif":
        return (await import("@jsquash/avif/encode")).init()
      case "decode:png":
        return (await import("@jsquash/png/decode")).init()
      case "decode:jpeg":
        return (await import("@jsquash/jpeg/decode")).init()
      case "decode:webp":
        return (await import("@jsquash/webp/decode")).init()
      case "decode:avif":
        return (await import("@jsquash/avif/decode")).init()
      default:
        return undefined
    }
  }

  await load().catch(() => undefined)
}
