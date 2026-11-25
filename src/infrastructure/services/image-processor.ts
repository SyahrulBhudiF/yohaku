import { Context, Effect, Layer } from "effect"

import { ImageProcessingError } from "@/infrastructure/errors/image"
import type { ImageFormat } from "@/libs/schemas/image"
import type { AnimatedFormat } from "@/libs/utils/image-codec/animation"
import { animationErrorMessage } from "@/libs/utils/image-codec/animation"
import {
  decodeImage,
  detectImageFormat,
  encodeImage,
  encodeInWorker,
  resizeInWorker,
  transcodeInWorker,
} from "@/libs/utils/image-codec"
import { transcodeGif } from "@/libs/utils/image-codec/gif"
import { optimizePng } from "@/libs/utils/image-codec/oxipng"
import { isAnimatedWebp, transcodeWebpAnimation } from "@/libs/utils/image-codec/webp-animation"
import { flattenOnWhite, resizeImageData, type ResizeOptions } from "@/libs/utils/image-resize"

export interface ProcessedImage {
  readonly data: Uint8Array<ArrayBuffer>
  readonly format: ImageFormat
}

export interface ResizedImage extends ProcessedImage {
  readonly width: number
  readonly height: number
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

  if (source === "png" && format === "png") {
    const data = yield* Effect.tryPromise({
      try: () => optimizePng(input),
      catch: () => new ImageProcessingError({ message: "Could not optimize this PNG." }),
    })

    return { data, format }
  }

  const animationTarget: AnimatedFormat | null =
    format === "gif" || format === "webp" ? format : null
  const animationSource: AnimatedFormat | null =
    source === "gif" || (source === "webp" && isAnimatedWebp(input)) ? source : null

  if (animationTarget !== null && animationSource !== null) {
    const message = animationErrorMessage(animationSource, animationTarget)
    const data = yield* Effect.tryPromise({
      try: () =>
        animationSource === "gif"
          ? transcodeGif(input, animationTarget, quality)
          : transcodeWebpAnimation(input, animationTarget, quality),
      catch: () => new ImageProcessingError({ message }),
    })

    if (!data) {
      return yield* new ImageProcessingError({ message })
    }

    return { data, format: animationTarget }
  }

  const image = yield* decode(input, source)
  const data = yield* encode(image, format, quality)

  return { data, format }
})

const resize = Effect.fn("ImageProcessor.resize")(function* (
  input: Uint8Array,
  options: ResizeOptions,
  format: ImageFormat,
  quality: number,
) {
  const source = yield* detectFormat(input)
  const image = yield* decode(input, source)
  const resized = resizeImageData(image, options)

  if (format === "jpeg") {
    flattenOnWhite(resized)
  }

  const data = yield* encode(resized, format, quality)

  return { data, format, width: resized.width, height: resized.height }
})

const resizeInWorkerEffect = Effect.fn("ImageProcessor.resizeInWorker")(function* (
  input: Uint8Array,
  options: ResizeOptions,
  format: ImageFormat,
  quality: number,
) {
  const response = yield* Effect.tryPromise({
    try: () => resizeInWorker(input, options, format, quality),
    catch: () => new ImageProcessingError({ message: "Could not process this image." }),
  })

  if (!response.ok) {
    return yield* new ImageProcessingError({ message: response.message })
  }

  return {
    data: response.data,
    format: response.format,
    width: response.width,
    height: response.height,
  }
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

const encodeInWorkerEffect = Effect.fn("ImageProcessor.encode")(function* (
  image: ImageData,
  format: ImageFormat,
  quality: number,
) {
  const response = yield* Effect.tryPromise({
    try: () => encodeInWorker(image, format, quality),
    catch: () => new ImageProcessingError({ message: "Could not process this image." }),
  })

  if (!response.ok) {
    return yield* new ImageProcessingError({ message: response.message })
  }

  return response.data
})

export class ImageProcessor extends Context.Service<
  ImageProcessor,
  {
    readonly detectFormat: (input: Uint8Array) => Effect.Effect<ImageFormat, ImageProcessingError>
    readonly transcode: (
      input: Uint8Array,
      format: ImageFormat,
      quality: number,
    ) => Effect.Effect<ProcessedImage, ImageProcessingError>
    /** Encodes RGBA pixels; the worker layer may take ownership of the buffer. */
    readonly encode: (
      image: ImageData,
      format: ImageFormat,
      quality: number,
    ) => Effect.Effect<Uint8Array<ArrayBuffer>, ImageProcessingError>
    /** Decodes, crops/rotates, resizes, and encodes without blocking the UI. */
    readonly resize: (
      input: Uint8Array,
      options: ResizeOptions,
      format: ImageFormat,
      quality: number,
    ) => Effect.Effect<ResizedImage, ImageProcessingError>
  }
>()("tools/ImageProcessor") {
  /** Runs the codecs on the calling thread. Used by tests and non-worker hosts. */
  static readonly layer = Layer.succeed(
    ImageProcessor,
    ImageProcessor.of({ detectFormat, transcode, encode, resize }),
  )

  /** Runs the codecs in a Web Worker so encoding never blocks the UI. */
  static readonly workerLayer = Layer.succeed(
    ImageProcessor,
    ImageProcessor.of({
      detectFormat,
      transcode: transcodeInWorkerEffect,
      encode: encodeInWorkerEffect,
      resize: resizeInWorkerEffect,
    }),
  )
}
