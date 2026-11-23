import { Context, Effect, Layer } from "effect"
import sharp, { type Sharp } from "sharp"

import { ImageProcessingError, UnsupportedFormatError } from "@/infrastructure/errors/image"
import { IMAGE_FORMATS, type ImageFormat } from "@/libs/schemas/image"

export interface ProcessedImage {
  readonly data: Uint8Array
  readonly format: ImageFormat
}

const isImageFormat = (value: string): value is ImageFormat =>
  IMAGE_FORMATS.some((format) => format === value)

const encode = (pipeline: Sharp, format: ImageFormat, quality: number) => {
  switch (format) {
    case "png":
      return pipeline.png({ quality, compressionLevel: 9, palette: quality < 100 })
    case "jpeg":
      return pipeline.jpeg({ quality, mozjpeg: true })
    case "webp":
      return pipeline.webp({ quality })
    case "avif":
      return pipeline.avif({ quality })
    case "gif":
      return pipeline.gif()
    case "tiff":
      return pipeline.tiff({ quality })
  }
}

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
    ) => Effect.Effect<ProcessedImage, ImageProcessingError>
  }
>()("tools/ImageProcessor") {
  static readonly layer = Layer.succeed(
    ImageProcessor,
    ImageProcessor.of({
      detectFormat: Effect.fn("ImageProcessor.detectFormat")(function* (input: Uint8Array) {
        const metadata = yield* Effect.tryPromise({
          try: () => sharp(input).metadata(),
          catch: () => new ImageProcessingError({ message: "The file is not a readable image." }),
        })
        const detected: string = metadata.format ?? "unknown"

        if (!isImageFormat(detected)) {
          return yield* new UnsupportedFormatError({
            message: `Unsupported source image format: ${detected}.`,
          })
        }

        return detected
      }),
      transcode: Effect.fn("ImageProcessor.transcode")(function* (
        input: Uint8Array,
        format: ImageFormat,
        quality: number,
      ) {
        const data = yield* Effect.tryPromise({
          try: () =>
            encode(
              sharp(input, { animated: format === "gif" || format === "webp" }).rotate(),
              format,
              quality,
            ).toBuffer(),
          catch: () =>
            new ImageProcessingError({ message: `Could not encode the image as ${format}.` }),
        })

        return { data: new Uint8Array(data), format }
      }),
    }),
  )
}
