export const decodeTiff = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  const UTIF = (await import("utif")).default
  const ifd = UTIF.decode(buffer)[0]

  if (!ifd) {
    return null
  }

  UTIF.decodeImage(buffer, ifd)

  return new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(ifd)), ifd.width, ifd.height)
}

export const encodeTiff = async (image: ImageData): Promise<Uint8Array<ArrayBuffer>> => {
  const UTIF = (await import("utif")).default
  const rgba = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength)

  return new Uint8Array(UTIF.encodeImage(rgba, image.width, image.height))
}
