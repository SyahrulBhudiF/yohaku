import { Effect } from "effect"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import { imagesToPdfWasm } from "@/libs/utils/image-pdf-wasm"

export interface PdfImageInput {
  readonly data: Uint8Array<ArrayBuffer>
  readonly format: "png" | "jpeg"
}

const buildPdf = async (
  images: ReadonlyArray<PdfImageInput>,
  pageSize: ImagePdfPageSize,
): Promise<Uint8Array<ArrayBuffer>> => {
  const wasm = await imagesToPdfWasm(images, pageSize)

  if (!wasm) {
    throw new PdfProcessingError({ message: "Could not create the PDF." })
  }

  return wasm
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
      catch: () => new PdfProcessingError({ message: "Could not create the PDF." }),
    })
  })
