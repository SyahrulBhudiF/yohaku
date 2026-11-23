import { Effect } from "effect"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"

export interface SignatureImage {
  readonly png: Uint8Array
  readonly url: string
  readonly aspect: number
}

const normalizeImage = async (source: Blob): Promise<SignatureImage> => {
  const bitmap = await createImageBitmap(source)
  const target = document.createElement("canvas")
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))

  target.width = Math.max(1, Math.round(bitmap.width * scale))
  target.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = target.getContext("2d")

  if (!context) {
    bitmap.close()
    throw new PdfProcessingError({ message: "Could not read the signature image." })
  }

  context.drawImage(bitmap, 0, 0, target.width, target.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, "image/png"))

  if (!blob) {
    throw new PdfProcessingError({ message: "Could not read the signature image." })
  }

  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    url: target.toDataURL("image/png"),
    aspect: target.width / target.height,
  }
}

export const normalizeSignatureImage = (
  source: Blob,
): Effect.Effect<SignatureImage, PdfProcessingError> =>
  Effect.tryPromise({
    try: () => normalizeImage(source),
    catch: () =>
      new PdfProcessingError({
        message: "Could not read the signature image. Choose a valid PNG, JPEG, or WebP.",
      }),
  })
