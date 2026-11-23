import { Effect } from "effect"
import type { ImageTracerOptions } from "imagetracerjs"

import { ImageProcessingError } from "@/infrastructure/errors/image"
import { MAX_VECTOR_SIDE, type VectorPreset } from "@/libs/schemas/image"
import { decodeImageData } from "@/libs/utils/image-decode"

export const VECTOR_OPTIONS: Record<VectorPreset, ImageTracerOptions> = {
  high: {
    numberofcolors: 64,
    colorquantcycles: 5,
    pathomit: 4,
    ltres: 0.5,
    qtres: 0.5,
    strokewidth: 1,
  },
  balanced: {
    numberofcolors: 32,
    colorquantcycles: 4,
    pathomit: 8,
    ltres: 1,
    qtres: 1,
    strokewidth: 1,
  },
  line: {
    numberofcolors: 2,
    colorquantcycles: 1,
    pathomit: 8,
    ltres: 0.5,
    qtres: 0.5,
    strokewidth: 1,
    rightangleenhance: true,
  },
}

export interface VectorizedImage {
  readonly svg: string
  readonly width: number
  readonly height: number
}

export const vectorizeImage = (
  file: File,
  preset: VectorPreset,
): Effect.Effect<VectorizedImage, ImageProcessingError> =>
  Effect.gen(function* () {
    const image = yield* Effect.tryPromise({
      try: () => decodeImageData(file, MAX_VECTOR_SIDE),
      catch: () =>
        new ImageProcessingError({
          message: "Could not read this image. Try a PNG, JPEG, or WebP.",
        }),
    })

    if (!image) {
      return yield* new ImageProcessingError({
        message: "Could not create an image canvas for this file.",
      })
    }

    const ImageTracer = yield* Effect.tryPromise({
      try: async () => {
        const module = await import("imagetracerjs")

        return module.default
      },
      catch: () => new ImageProcessingError({ message: "Could not load the SVG vectorizer." }),
    })

    const svg = yield* Effect.try({
      try: () =>
        ImageTracer.imagedataToSVG(
          { data: image.data, width: image.width, height: image.height },
          VECTOR_OPTIONS[preset],
        ),
      catch: () => new ImageProcessingError({ message: "Could not trace this image." }),
    })

    return { svg, width: image.width, height: image.height }
  })
