import { Context, Effect, Layer, Schema, Semaphore } from "effect"

import { PdfOcrError } from "@/infrastructure/errors/pdf"
import {
  MAX_PDF_OCR_BATCH_PAGES,
  MAX_PDF_OCR_IMAGE_SIDE,
  PdfOcrPagesSchema,
  type PdfOcrLine,
  type PdfOcrQuality,
} from "@/libs/schemas/pdf"

type OcrEngine = Awaited<ReturnType<typeof import("@paddleocr/paddleocr-js").createWorkerOcr>>

const MODEL_CONFIG = {
  speed: {
    detectionName: "PP-OCRv6_tiny_det",
    detectionAsset:
      "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_onnx_infer.tar",
    recognitionName: "PP-OCRv6_tiny_rec",
    recognitionAsset:
      "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_rec_onnx_infer.tar",
  },
  accuracy: {
    detectionName: "PP-OCRv6_small_det",
    detectionAsset:
      "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_onnx_infer.tar",
    recognitionName: "PP-OCRv6_small_rec",
    recognitionAsset:
      "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_rec_onnx_infer.tar",
  },
}

const createOcr = (quality: PdfOcrQuality) => {
  const config = MODEL_CONFIG[quality]

  return Effect.tryPromise({
    try: () =>
      import("@paddleocr/paddleocr-js").then(({ createWorkerOcr }) =>
        createWorkerOcr({
          textDetectionModelName: config.detectionName,
          textDetectionModelAsset: { url: config.detectionAsset },
          textDetLimitSideLen: MAX_PDF_OCR_IMAGE_SIDE,
          // Don't undo the speed mode's smaller raster by upscaling it for detection.
          ...(quality === "speed" ? { textDetLimitType: "max" } : {}),
          textRecognitionModelName: config.recognitionName,
          textRecognitionModelAsset: { url: config.recognitionAsset },
          batch_size: MAX_PDF_OCR_BATCH_PAGES,
          textDetectionBatchSize: MAX_PDF_OCR_BATCH_PAGES,
          // The SDK selects the WASM files matching the runtime bundled in its worker.
          ortOptions: {
            backend: "auto",
            numThreads: globalThis.crossOriginIsolated
              ? Math.min(2, navigator.hardwareConcurrency)
              : 1,
            simd: true,
          },
        }),
      ),
    catch: () =>
      new PdfOcrError({ message: "Could not start OCR. Check your connection and retry." }),
  })
}

const getBounds = (points: ReadonlyArray<readonly [number, number]>) => {
  let x = Infinity
  let y = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const [pointX, pointY] of points) {
    x = Math.min(x, pointX)
    y = Math.min(y, pointY)
    right = Math.max(right, pointX)
    bottom = Math.max(bottom, pointY)
  }

  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  return { x, y, width: right - x, height: bottom - y }
}

const isPdfOcrPages = Schema.is(PdfOcrPagesSchema)

export class PdfOcr extends Context.Service<
  PdfOcr,
  {
    readonly prepare: (quality: PdfOcrQuality) => Effect.Effect<void, PdfOcrError>
    readonly recognizePages: (
      images: ReadonlyArray<ImageBitmap>,
      quality: PdfOcrQuality,
    ) => Effect.Effect<ReadonlyArray<ReadonlyArray<PdfOcrLine>>, PdfOcrError>
  }
>()("tools/PdfOcr") {
  static readonly layer = Layer.effect(
    PdfOcr,
    Effect.gen(function* () {
      const enginePermit = yield* Semaphore.make(1)
      let current: { readonly quality: PdfOcrQuality; readonly engine: OcrEngine } | undefined
      const disposeCurrent = Effect.gen(function* () {
        const previous = current

        current = undefined

        if (previous) {
          yield* Effect.ignore(Effect.tryPromise(() => previous.engine.dispose()))
        }
      })

      yield* Effect.addFinalizer(() => enginePermit.withPermit(disposeCurrent))

      const getOcr = (quality: PdfOcrQuality) =>
        Effect.gen(function* () {
          if (current?.quality === quality) return current.engine

          yield* disposeCurrent

          const engine = yield* createOcr(quality)

          current = { quality, engine }

          return engine
        }).pipe(Effect.uninterruptible)

      return PdfOcr.of({
        prepare: (quality) => enginePermit.withPermit(getOcr(quality)).pipe(Effect.asVoid),
        recognizePages: (images, quality) =>
          enginePermit.withPermit(
            Effect.gen(function* () {
              const ocr = yield* getOcr(quality)
              const results = yield* Effect.tryPromise({
                try: () => ocr.predict(images, { textRecScoreThresh: 0.45 }),
                catch: () =>
                  new PdfOcrError({ message: "Could not recognize text on these pages." }),
              }).pipe(Effect.uninterruptible)
              const lines = results.map((result) => {
                const pageLines: PdfOcrLine[] = []

                for (const item of result.items) {
                  const text = item.text.trim()

                  if (text.length > 0 && item.poly.length > 0) {
                    pageLines.push({ ...getBounds(item.poly), text, score: item.score })
                  }
                }

                return pageLines
              })

              if (lines.length !== images.length || !isPdfOcrPages(lines)) {
                return yield* new PdfOcrError({
                  message: "The OCR engine returned invalid text data.",
                })
              }

              return lines
            }),
          ),
      })
    }),
  )
}
