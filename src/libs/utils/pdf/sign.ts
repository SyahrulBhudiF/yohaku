import { Effect } from "effect"
import type { PDFImage } from "pdf-lib"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"

/** Page is one-based; the rectangle is normalized to the displayed crop box, from its top-left. */
export type SignaturePlacement = {
  page: number
  png: Uint8Array
  x: number
  y: number
  width: number
  height: number
}

const embedSignatures = async (
  file: File,
  placements: readonly SignaturePlacement[],
): Promise<Blob> => {
  const { degrees, PDFDocument } = await import("pdf-lib")
  const document = await PDFDocument.load(await file.arrayBuffer())
  const pages = document.getPages()
  const images = new Map<Uint8Array, PDFImage>()

  for (const placement of placements) {
    const { page: pageNumber, png, x, y, width, height } = placement

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > pages.length ||
      ![x, y, width, height].every(Number.isFinite) ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > 1 ||
      y + height > 1
    ) {
      throw new PdfProcessingError({ message: "Invalid signature placement." })
    }

    const page = pages[pageNumber - 1]

    if (!page) {
      throw new PdfProcessingError({ message: "Invalid signature page." })
    }

    const crop = page.getCropBox()
    const media = page.getMediaBox()
    const left = Math.max(crop.x, media.x)
    const bottom = Math.max(crop.y, media.y)
    const boxWidth = Math.min(crop.x + crop.width, media.x + media.width) - left
    const boxHeight = Math.min(crop.y + crop.height, media.y + media.height) - bottom
    const rotation = ((page.getRotation().angle % 360) + 360) % 360

    if (boxWidth <= 0 || boxHeight <= 0 || ![0, 90, 180, 270].includes(rotation)) {
      throw new PdfProcessingError({ message: "Unsupported PDF page geometry." })
    }

    let image = images.get(png)

    if (!image) {
      image = await document.embedPng(png)
      images.set(png, image)
    }

    const sideways = rotation === 90 || rotation === 270
    const imageWidth = width * (sideways ? boxHeight : boxWidth)
    const imageHeight = height * (sideways ? boxWidth : boxHeight)
    const origin =
      rotation === 90
        ? { x: left + (y + height) * boxWidth, y: bottom + x * boxHeight }
        : rotation === 180
          ? { x: left + (1 - x) * boxWidth, y: bottom + (y + height) * boxHeight }
          : rotation === 270
            ? { x: left + (1 - y - height) * boxWidth, y: bottom + (1 - x) * boxHeight }
            : { x: left + x * boxWidth, y: bottom + (1 - y - height) * boxHeight }

    page.drawImage(image, {
      ...origin,
      width: imageWidth,
      height: imageHeight,
      rotate: degrees(rotation),
    })
  }

  return new Blob([Uint8Array.from(await document.save())], { type: "application/pdf" })
}

export const signPdf = (
  file: File,
  placements: readonly SignaturePlacement[],
): Effect.Effect<Blob, PdfProcessingError> =>
  Effect.tryPromise({
    try: () => embedSignatures(file, placements),
    catch: (cause) =>
      cause instanceof PdfProcessingError
        ? cause
        : new PdfProcessingError({
            message: "Could not sign this PDF. Encrypted PDFs are not supported.",
          }),
  })
