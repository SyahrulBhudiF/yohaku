const readByte = (bytes: Uint8Array, offset: number) => bytes[offset] ?? -1

const skipSubBlocks = (bytes: Uint8Array, offset: number) => {
  let cursor = offset

  while (cursor < bytes.length) {
    const length = readByte(bytes, cursor)

    cursor += 1

    if (length === 0) return cursor
    if (length < 0 || cursor + length > bytes.length) return -1

    cursor += length
  }

  return -1
}

export const isAnimatedGif = (bytes: Uint8Array) => {
  if (
    bytes.length < 14 ||
    (String.fromCharCode(...bytes.subarray(0, 6)) !== "GIF89a" &&
      String.fromCharCode(...bytes.subarray(0, 6)) !== "GIF87a")
  ) {
    return false
  }

  const screenPacked = readByte(bytes, 10)
  let cursor = 13

  if (screenPacked & 0x80) cursor += 3 * 2 ** ((screenPacked & 0x07) + 1)

  let frameCount = 0
  let hasTrailer = false

  while (cursor < bytes.length) {
    const marker = readByte(bytes, cursor)

    cursor += 1

    if (marker === 0x3b) {
      hasTrailer = true

      break
    }

    if (marker === 0x21) {
      cursor += 1
      cursor = skipSubBlocks(bytes, cursor)

      if (cursor < 0) return false

      continue
    }

    if (marker !== 0x2c || cursor + 9 > bytes.length) return false

    const imagePacked = readByte(bytes, cursor + 8)

    cursor += 9

    if (imagePacked & 0x80) cursor += 3 * 2 ** ((imagePacked & 0x07) + 1)
    if (cursor >= bytes.length) return false

    cursor += 1
    cursor = skipSubBlocks(bytes, cursor)

    if (cursor < 0) return false

    frameCount += 1
  }

  return hasTrailer && frameCount >= 2
}
