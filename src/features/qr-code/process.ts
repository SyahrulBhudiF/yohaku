import { Effect, Schema } from "effect"

import { QrCodeProcessingError } from "@/infrastructure/errors/qr"
import { runEffect } from "@/infrastructure/runtime"
import {
  GeneratedQrCodeSchema,
  MAX_QR_IMAGE_BYTES,
  MAX_QR_IMAGE_PIXELS,
  MAX_QR_TEXT_BYTES,
  type GeneratedQrCode,
  type QrCodeFormValues,
  ScannedQrCodeSchema,
} from "@/libs/schemas/qr"

const generateQrCodeProgram = (input: QrCodeFormValues) =>
  Effect.gen(function* () {
    const text = input.text.trim()

    if (!text) {
      return yield* new QrCodeProcessingError({ message: "Enter some text or a URL." })
    }

    if (new TextEncoder().encode(text).byteLength > MAX_QR_TEXT_BYTES) {
      return yield* new QrCodeProcessingError({
        message: `Keep the text under ${MAX_QR_TEXT_BYTES} UTF-8 bytes for a reliably readable QR code.`,
      })
    }

    const dataUrl = yield* Effect.tryPromise({
      try: async () => {
        const QRCode = await import("qrcode")

        if (input.format === "svg") {
          const svg = await QRCode.toString(text, { type: "svg", margin: 4 })

          return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        }

        return QRCode.toDataURL(text, { type: "image/png", margin: 4, width: 512 })
      },
      catch: () =>
        new QrCodeProcessingError({
          message: "Could not create a QR code. Try shorter text or a URL.",
        }),
    })

    return yield* Schema.decodeEffect(GeneratedQrCodeSchema)({
      dataUrl,
      fileName: `yohaku-qr-code.${input.format}`,
      format: input.format,
    }).pipe(
      Effect.mapError(
        () => new QrCodeProcessingError({ message: "Could not create a QR code result." }),
      ),
    )
  })

export const generateQrCode = (input: QrCodeFormValues): Promise<GeneratedQrCode> =>
  runEffect(generateQrCodeProgram(input))

type ScanErrorCode = "too-large" | "unreadable" | "no-code" | "worker"

type ScanWorkerResponse =
  | { readonly ok: true; readonly data: string }
  | { readonly ok: false; readonly code: Exclude<ScanErrorCode, "worker"> }

const scanInWorker = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
    const finish = () => worker.terminate()

    worker.onmessage = ({ data }: MessageEvent<ScanWorkerResponse>) => {
      finish()

      if (!data.ok) {
        reject(data.code)

        return
      }

      resolve(data.data)
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
      return `Images can be up to ${MAX_QR_IMAGE_PIXELS / 1_000_000} megapixels.`
    case "unreadable":
      return "This image could not be read. Try a valid PNG, JPEG, or WebP image."
    case "no-code":
      return "No QR code was found. Try a clearer image with the full code visible."
    default:
      return "Could not scan this image. Try another image."
  }
}

const scanQrCodeProgram = (file: File) =>
  Effect.gen(function* () {
    if (file.size > MAX_QR_IMAGE_BYTES) {
      return yield* new QrCodeProcessingError({
        message: `Images can be at most ${MAX_QR_IMAGE_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (file.type && !file.type.startsWith("image/")) {
      return yield* new QrCodeProcessingError({ message: "Choose an image file to scan." })
    }

    const decoded = yield* Effect.tryPromise({
      try: () => scanInWorker(file),
      catch: (cause) => new QrCodeProcessingError({ message: scanErrorMessage(cause) }),
    })

    return yield* Schema.decodeEffect(ScannedQrCodeSchema)(decoded).pipe(
      Effect.mapError(() => new QrCodeProcessingError({ message: "Could not read this QR code." })),
    )
  })

export const scanQrCodeImage = (file: File): Promise<string> => runEffect(scanQrCodeProgram(file))
