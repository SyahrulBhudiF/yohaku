import { Effect, Result, Schema } from "effect"

import { BarcodeProcessingError } from "@/infrastructure/errors/barcode"
import { runEffect } from "@/infrastructure/runtime"
import {
  GeneratedBarcodeSchema,
  MAX_BARCODE_IMAGE_BYTES,
  MAX_BARCODE_IMAGE_PIXELS,
  ScannedBarcodeSchema,
  type BarcodeFormat,
  type BarcodeFormValues,
  type GeneratedBarcode,
  type ScannedBarcode,
} from "@/libs/schemas/barcode"
import { detectImageInputFormat } from "@/libs/utils/image-codec"
import { readFileHeader } from "@/libs/utils/image-decode"
import { normalizeBarcodeValue } from "./validation"

const BARCODE_BCID: Record<BarcodeFormat, string> = {
  code128: "code128",
  ean13: "ean13",
  upca: "upca",
}

const generateBarcodeProgram = (input: BarcodeFormValues) =>
  Effect.gen(function* () {
    const normalized = normalizeBarcodeValue(input.format, input.value)

    if (!normalized.ok) {
      return yield* new BarcodeProcessingError({ message: normalized.message })
    }

    const generated = yield* Effect.tryPromise({
      try: async () => {
        const bwip = await import("bwip-js/browser")
        const options = {
          bcid: BARCODE_BCID[input.format],
          text: normalized.value,
          scale: 3,
          height: 14,
          padding: 8,
          includetext: true,
          textxalign: "center" as const,
          backgroundcolor: "FFFFFF",
          barcolor: "000000",
          textcolor: "000000",
        }
        const svg = bwip.toSVG(options)
        const canvas = document.createElement("canvas")

        bwip.toCanvas(canvas, options)

        return {
          svgDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
          pngDataUrl: canvas.toDataURL("image/png"),
          fileName: `yohaku-${input.format}-barcode`,
          format: input.format,
          text: normalized.value,
        }
      },
      catch: () =>
        new BarcodeProcessingError({
          message: "Could not create this barcode. Check the value and try again.",
        }),
    })

    return yield* Schema.decodeEffect(GeneratedBarcodeSchema)(generated).pipe(
      Effect.mapError(
        () => new BarcodeProcessingError({ message: "Could not create this barcode result." }),
      ),
    )
  })

export const generateBarcode = (input: BarcodeFormValues): Promise<GeneratedBarcode> =>
  runEffect(generateBarcodeProgram(input))

type ScanErrorCode = "too-large" | "unreadable" | "no-code" | "worker"

type ScanWorkerResponse =
  | { readonly ok: true; readonly format: string; readonly text: string }
  | { readonly ok: false; readonly code: Exclude<ScanErrorCode, "worker"> }

const scanInWorker = (file: File) =>
  new Promise<ScannedBarcode>((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
    const finish = () => worker.terminate()

    worker.onmessage = ({ data }: MessageEvent<ScanWorkerResponse>) => {
      finish()

      if (!data.ok) {
        reject(data.code)

        return
      }

      resolve({ format: data.format, text: data.text })
    }

    worker.onerror = () => {
      finish()
      reject("worker")
    }

    worker.postMessage({ file })
  })

const scanErrorMessage = (cause: unknown) => {
  switch (cause) {
    case "too-large":
      return `Images can be up to ${MAX_BARCODE_IMAGE_PIXELS / 1_000_000} megapixels.`
    case "unreadable":
      return "This image could not be read. Try a valid PNG, JPEG, WebP, AVIF, or GIF image."
    case "no-code":
      return "No barcode was found. Try a clearer image with the full barcode visible."
    default:
      return "Could not scan this image. Try another image."
  }
}

const scanBarcodeProgram = (file: File) =>
  Effect.gen(function* () {
    if (file.size > MAX_BARCODE_IMAGE_BYTES) {
      return yield* new BarcodeProcessingError({
        message: `Images can be at most ${MAX_BARCODE_IMAGE_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (file.type && !file.type.startsWith("image/")) {
      return yield* new BarcodeProcessingError({ message: "Choose an image file to scan." })
    }

    const header = yield* Effect.tryPromise({
      try: () => readFileHeader(file, 16),
      catch: () => new BarcodeProcessingError({ message: "Could not read this image." }),
    }).pipe(Effect.result)

    if (Result.isFailure(header)) {
      return yield* header.failure
    }

    const format = detectImageInputFormat(header.success)

    if (
      format !== "png" &&
      format !== "jpeg" &&
      format !== "webp" &&
      format !== "avif" &&
      format !== "gif"
    ) {
      return yield* new BarcodeProcessingError({
        message: "Choose a PNG, JPEG, WebP, AVIF, or GIF image.",
      })
    }

    const decoded = yield* Effect.tryPromise({
      try: () => scanInWorker(file),
      catch: (cause) => new BarcodeProcessingError({ message: scanErrorMessage(cause) }),
    })

    return yield* Schema.decodeEffect(ScannedBarcodeSchema)(decoded).pipe(
      Effect.mapError(
        () => new BarcodeProcessingError({ message: "Could not read this barcode." }),
      ),
    )
  })

export const scanBarcodeImage = (file: File): Promise<ScannedBarcode> =>
  runEffect(scanBarcodeProgram(file))
