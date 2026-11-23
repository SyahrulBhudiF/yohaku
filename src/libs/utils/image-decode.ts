export interface DecodedImage {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

export interface ImageSize {
  readonly width: number
  readonly height: number
}

const makeCanvas = (width: number, height: number) => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height)
  }

  const canvas = document.createElement("canvas")

  canvas.width = width
  canvas.height = height

  return canvas
}

export const readImageSize = async (file: Blob): Promise<ImageSize> => {
  const bitmap = await createImageBitmap(file)

  try {
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

export const decodeImageData = async (
  file: Blob,
  maxSide: number,
): Promise<DecodedImage | null> => {
  const bitmap = await createImageBitmap(file)

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = makeCanvas(width, height)
    const context = canvas.getContext("2d", { willReadFrequently: true })

    if (!context) {
      return null
    }

    context.drawImage(bitmap, 0, 0, width, height)

    const image = context.getImageData(0, 0, width, height)

    return { data: image.data, width, height }
  } finally {
    bitmap.close()
  }
}
