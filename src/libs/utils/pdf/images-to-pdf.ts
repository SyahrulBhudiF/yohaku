import { Effect } from "effect"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import { imagesToPdfWasm } from "@/libs/utils/image-pdf-wasm"
import { imagesToPdfInWorker } from "./image-pdf-worker-client"

export interface PdfImageInput {
  readonly data: Uint8Array<ArrayBuffer>
  readonly format: "png" | "jpeg"
}

const buildPdf = async (
  images: ReadonlyArray<PdfImageInput>,
  pageSize: ImagePdfPageSize,
): Promise<Uint8Array<ArrayBuffer>> => {
  const result =
    typeof Worker === "undefined"
      ? await imagesToPdfWasm(images, pageSize)
      : await imagesToPdfInWorker(images, pageSize)

  if (!result.ok) {
    throw new PdfProcessingError({ message: result.message })
  }

  return result.bytes
}

export const imagesToPdf = (
  images: ReadonlyArray<PdfImageInput>,
  pageSize: ImagePdfPageSize,
): Effect.Effect<Uint8Array<ArrayBuffer>, PdfProcessingError> =>
  Effect.gen(function* () {
    if (images.length === 0) {
      return yield* new PdfProcessingError({ message: "Add at least one image." })
    }

    return yield* Effect.tryPromise({
      try: () => buildPdf(images, pageSize),
      catch: (cause) =>
        cause instanceof PdfProcessingError
          ? cause
          : new PdfProcessingError({ message: "Could not create the PDF." }),
    })
  })
