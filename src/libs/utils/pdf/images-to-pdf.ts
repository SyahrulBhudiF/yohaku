import { Effect } from "effect"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"

export interface PdfImageInput {
  readonly data: Uint8Array<ArrayBuffer>
  readonly format: "png" | "jpeg"
}

const A4_SHORT_SIDE = 595.28
const A4_LONG_SIDE = 841.89
const FIT_LONG_SIDE = 842
const A4_MARGIN = 24

const buildPdf = async (
  images: ReadonlyArray<PdfImageInput>,
  pageSize: ImagePdfPageSize,
): Promise<Uint8Array<ArrayBuffer>> => {
  const { PDFDocument } = await import("pdf-lib")
  const document = await PDFDocument.create()

  for (const input of images) {
    const embedded =
      input.format === "jpeg"
        ? await document.embedJpg(input.data)
        : await document.embedPng(input.data)
    const imageWidth = embedded.width
    const imageHeight = embedded.height

    if (pageSize === "fit") {
      const scale = FIT_LONG_SIDE / Math.max(imageWidth, imageHeight)
      const width = imageWidth * scale
      const height = imageHeight * scale
      const page = document.addPage([width, height])

      page.drawImage(embedded, { x: 0, y: 0, width, height })
      continue
    }

    const landscape = imageWidth > imageHeight
    const width = landscape ? A4_LONG_SIDE : A4_SHORT_SIDE
    const height = landscape ? A4_SHORT_SIDE : A4_LONG_SIDE
    const scale = Math.min(
      (width - A4_MARGIN * 2) / imageWidth,
      (height - A4_MARGIN * 2) / imageHeight,
    )
    const drawWidth = imageWidth * scale
    const drawHeight = imageHeight * scale
    const page = document.addPage([width, height])

    page.drawImage(embedded, {
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    })
  }

  const bytes = await document.save()

  return new Uint8Array(bytes)
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
