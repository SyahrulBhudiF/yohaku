import { Context, Effect, Layer, Result } from "effect"

import { ImageProcessingError } from "@/infrastructure/errors/image"
import type { ImageFormat } from "@/libs/schemas/image"
import type { ImageInputFormat } from "@/libs/schemas/image"
import type { AnimatedFormat } from "@/libs/utils/image-codec/animation"
import { animationErrorMessage } from "@/libs/utils/image-codec/animation"
import {
  decodeImage,
  decodeHeicPreview,
  detectImageInputFormat,
  encodeImage,
  encodeInWorker,
  faviconsInWorker,
  measureInWorker,
  measureHeic,
  resizeInWorker,
  transcodeInWorker,
} from "@/libs/utils/image-codec"
import { transcodeGif } from "@/libs/utils/image-codec/gif"
import { optimizePng } from "@/libs/utils/image-codec/oxipng"
import { isAnimatedWebp, transcodeWebpAnimation } from "@/libs/utils/image-codec/webp-animation"
import { fitImageOnSquare } from "@/libs/utils/favicon"
import {
  fitImageDataWithin,
  flattenOnWhite,
  resizeImageData,
  type ResizeOptions,
} from "@/libs/utils/image-resize"

export interface ProcessedImage {
  readonly data: Uint8Array<ArrayBuffer>
  readonly format: ImageFormat
}

export interface ResizedImage extends ProcessedImage {
  readonly width: number
  readonly height: number
}

export interface MeasuredImage {
  readonly width: number
  readonly height: number
}

export interface FaviconImage {
  readonly size: number
  readonly data: Uint8Array<ArrayBuffer>
}

const detectInputFormat = Effect.fn("ImageProcessor.detectInputFormat")(function* (
  input: Uint8Array,
) {
  const detected = detectImageInputFormat(input)

  if (detected === null) {
    return yield* new ImageProcessingError({ message: "The file is not a readable image." })
  }

  return detected
})

const detectFormat = Effect.fn("ImageProcessor.detectFormat")(function* (input: Uint8Array) {
  const detected = yield* detectInputFormat(input)

  return detected === "heic" ? "jpeg" : detected
})

const decode = (
  input: Uint8Array,
  format: ImageInputFormat,
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
  maxSide?: number,
  preview?: boolean,
) {
  const source = yield* detectInputFormat(input)

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

  const decoded =
    preview && source === "heic"
      ? yield* Effect.tryPromise({
          try: () => decodeHeicPreview(input),
          catch: () => new ImageProcessingError({ message: "Could not read this image." }),
        })
      : yield* decode(input, source)

  if (!decoded) {
    return yield* new ImageProcessingError({ message: `Could not decode ${source}.` })
  }

  const image = maxSide ? fitImageDataWithin(decoded, maxSide) : decoded
  const data = yield* encode(image, format, quality)

  return { data, format }
})

const resize = Effect.fn("ImageProcessor.resize")(function* (
  input: Uint8Array,
  options: ResizeOptions,
  format: ImageFormat,
  quality: number,
) {
  const source = yield* detectInputFormat(input)
  const image = yield* decode(input, source)
  const resized = resizeImageData(image, options)

  if (format === "jpeg") {
    flattenOnWhite(resized)
  }

  const data = yield* encode(resized, format, quality)

  return { data, format, width: resized.width, height: resized.height }
})

const measure = Effect.fn("ImageProcessor.measure")(function* (input: Uint8Array) {
  const source = yield* detectInputFormat(input)

  if (source === "heic") {
    const measured = yield* Effect.tryPromise({
      try: () => measureHeic(input),
      catch: () => new ImageProcessingError({ message: "Could not read this image." }),
    }).pipe(Effect.result)

    if (Result.isSuccess(measured)) {
      return measured.success
    }
  }

  const image = yield* decode(input, source)

  return { width: image.width, height: image.height }
})

const favicons = Effect.fn("ImageProcessor.favicons")(function* (
  input: Uint8Array,
  sizes: ReadonlyArray<number>,
) {
  const source = yield* detectInputFormat(input)
  const image = yield* decode(input, source)

  return yield* Effect.forEach(sizes, (size) =>
    Effect.map(encode(fitImageOnSquare(image, size), "png", 100), (data) => ({ size, data })),
  )
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
  maxSide?: number,
  preview?: boolean,
) {
  const response = yield* Effect.tryPromise({
    try: () => transcodeInWorker(input, format, quality, maxSide, preview),
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

const measureInWorkerEffect = Effect.fn("ImageProcessor.measureInWorker")(function* (
  input: Uint8Array,
) {
  const response = yield* Effect.tryPromise({
    try: () => measureInWorker(input),
    catch: () => new ImageProcessingError({ message: "Could not process this image." }),
  })

  if (!response.ok) {
    return yield* new ImageProcessingError({ message: response.message })
  }

  return { width: response.width, height: response.height }
})

const faviconsInWorkerEffect = Effect.fn("ImageProcessor.faviconsInWorker")(function* (
  input: Uint8Array,
  sizes: ReadonlyArray<number>,
) {
  const response = yield* Effect.tryPromise({
    try: () => faviconsInWorker(input, sizes),
    catch: () => new ImageProcessingError({ message: "Could not process this image." }),
  })

  if (!response.ok) {
    return yield* new ImageProcessingError({ message: response.message })
  }

  return response.icons
})

export class ImageProcessor extends Context.Service<
  ImageProcessor,
  {
    readonly detectFormat: (input: Uint8Array) => Effect.Effect<ImageFormat, ImageProcessingError>
    readonly measure: (input: Uint8Array) => Effect.Effect<MeasuredImage, ImageProcessingError>
    readonly favicons: (
      input: Uint8Array,
      sizes: ReadonlyArray<number>,
    ) => Effect.Effect<ReadonlyArray<FaviconImage>, ImageProcessingError>
    readonly transcode: (
      input: Uint8Array,
      format: ImageFormat,
      quality: number,
      maxSide?: number,
      preview?: boolean,
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
    ImageProcessor.of({ detectFormat, measure, favicons, transcode, encode, resize }),
  )

  /** Runs the codecs in a Web Worker so encoding never blocks the UI. */
  static readonly workerLayer = Layer.succeed(
    ImageProcessor,
    ImageProcessor.of({
      detectFormat,
      measure: measureInWorkerEffect,
      favicons: faviconsInWorkerEffect,
      transcode: transcodeInWorkerEffect,
      encode: encodeInWorkerEffect,
      resize: resizeInWorkerEffect,
    }),
  )
}
