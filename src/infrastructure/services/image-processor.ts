import { Context, Effect, Layer } from "effect"

import { ImageProcessingError, UnsupportedFormatError } from "@/infrastructure/errors/image"
import type { ImageFormat } from "@/libs/schemas/image"
import {
  decodeImage,
  detectImageFormat,
  encodeImage,
  transcodeInWorker,
} from "@/libs/utils/image-codec"

export interface ProcessedImage {
  readonly data: Uint8Array<ArrayBuffer>
  readonly format: ImageFormat
}

const detectFormat = Effect.fn("ImageProcessor.detectFormat")(function* (input: Uint8Array) {
  const detected = detectImageFormat(input)

  if (detected === null) {
    return yield* new ImageProcessingError({ message: "The file is not a readable image." })
  }

  return detected
})

const decode = (
  input: Uint8Array,
  format: ImageFormat,
): Effect.Effect<ImageData, ImageProcessingError> =>
  Effect.gen(function* () {
    const image = yield* Effect.tryPromise({
      try: () => decodeImage(input, format),
      catch: () => new ImageProcessingError({ message: "Could not read this image." }),
    })

    if (!image) {
      return yield* new ImageProcessingError({ message: `Could not decode ${format}.` })
    }

    return image
  })

const encode = (
  image: ImageData,
  format: ImageFormat,
  quality: number,
): Effect.Effect<Uint8Array<ArrayBuffer>, ImageProcessingError> =>
  Effect.tryPromise({
    try: () => encodeImage(image, format, quality),
    catch: () => new ImageProcessingError({ message: `Could not encode the image as ${format}.` }),
  })

const transcode = Effect.fn("ImageProcessor.transcode")(function* (
  input: Uint8Array,
  format: ImageFormat,
  quality: number,
) {
  const source = yield* detectFormat(input)
  const image = yield* decode(input, source)
  const data = yield* encode(image, format, quality)

  return { data, format }
})

const transcodeInWorkerEffect = Effect.fn("ImageProcessor.transcodeInWorker")(function* (
  input: Uint8Array,
  format: ImageFormat,
  quality: number,
) {
  const response = yield* Effect.tryPromise({
    try: () => transcodeInWorker(input, format, quality),
    catch: () => new ImageProcessingError({ message: "Could not process this image." }),
  })

  if (!response.ok) {
    return yield* new ImageProcessingError({ message: response.message })
  }

  return { data: response.data, format: response.format }
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
  /** Runs the codecs on the calling thread. Used by tests and non-worker hosts. */
  static readonly layer = Layer.succeed(
    ImageProcessor,
    ImageProcessor.of({ detectFormat, transcode }),
  )

  /** Runs the codecs in a Web Worker so encoding never blocks the UI. */
  static readonly workerLayer = Layer.succeed(
    ImageProcessor,
    ImageProcessor.of({ detectFormat, transcode: transcodeInWorkerEffect }),
  )
}
