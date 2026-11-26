import type { ImageFormat, ImageInputFormat } from "@/libs/schemas/image"

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length))

export const detectImageInputFormat = (input: Uint8Array): ImageInputFormat | null => {
  const startsWith = (signature: readonly number[], offset = 0) =>
    signature.every((byte, index) => input[offset + index] === byte)

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png"
  }

  if (startsWith([0xff, 0xd8, 0xff])) {
    return "jpeg"
  }

  if (input.length >= 12 && ascii(input, 0, 4) === "RIFF" && ascii(input, 8, 4) === "WEBP") {
    return "webp"
  }

  if (input.length >= 12 && ascii(input, 4, 4) === "ftyp") {
    // AVIF and HEIF can use a generic major brand, so scan compatible brands
    // too and prefer AVIF when both formats are declared.
    const boxSize = ((input[0]! << 24) | (input[1]! << 16) | (input[2]! << 8) | input[3]!) >>> 0
    const end = Math.min(boxSize, input.length)
    let isAvif = false
    let isHeif = false

    for (let offset = 8; offset + 4 <= end; offset += 4) {
      const brand = ascii(input, offset, 4)

      if (brand === "avif" || brand === "avis") {
        isAvif = true
      } else if (
        [
          "heic",
          "heif",
          "heix",
          "heim",
          "heis",
          "hevc",
          "hevx",
          "hevm",
          "hevs",
          "mif1",
          "msf1",
        ].includes(brand)
      ) {
        isHeif = true
      }
    }

    if (isAvif) {
      return "avif"
    }

    if (isHeif) {
      return "heic"
    }
  }

  if (ascii(input, 0, 4) === "GIF8") {
    return "gif"
  }

  if (startsWith([0x49, 0x49, 0x2a, 0x00]) || startsWith([0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff"
  }

  return null
}

export const detectImageFormat = (input: Uint8Array): ImageFormat | null => {
  const format = detectImageInputFormat(input)

  return format === "heic" ? null : format
}
