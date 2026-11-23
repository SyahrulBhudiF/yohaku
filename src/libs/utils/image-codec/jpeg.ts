const ORIENTATION_TAG = 0x0112
const SHORT_TYPE = 3

const read16 = (input: Uint8Array, offset: number, littleEndian: boolean): number =>
  littleEndian
    ? input[offset]! | (input[offset + 1]! << 8)
    : (input[offset]! << 8) | input[offset + 1]!

const read32 = (input: Uint8Array, offset: number, littleEndian: boolean): number =>
  littleEndian
    ? (input[offset]! |
        (input[offset + 1]! << 8) |
        (input[offset + 2]! << 16) |
        (input[offset + 3]! << 24)) >>>
      0
    : ((input[offset]! << 24) |
        (input[offset + 1]! << 16) |
        (input[offset + 2]! << 8) |
        input[offset + 3]!) >>>
      0

const readTiffOrientation = (input: Uint8Array, start: number, end: number): number => {
  if (start + 8 > end) {
    return 1
  }

  const littleEndian = input[start] === 0x49 && input[start + 1] === 0x49
  const bigEndian = input[start] === 0x4d && input[start + 1] === 0x4d

  if ((!littleEndian && !bigEndian) || read16(input, start + 2, littleEndian) !== 0x2a) {
    return 1
  }

  const ifd = start + read32(input, start + 4, littleEndian)

  if (ifd < start || ifd + 2 > end) {
    return 1
  }

  const count = read16(input, ifd, littleEndian)

  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12

    if (entry + 12 > end) {
      break
    }

    if (read16(input, entry, littleEndian) !== ORIENTATION_TAG) {
      continue
    }

    if (
      read16(input, entry + 2, littleEndian) !== SHORT_TYPE ||
      read32(input, entry + 4, littleEndian) < 1
    ) {
      return 1
    }

    const orientation = read16(input, entry + 8, littleEndian)

    return orientation >= 1 && orientation <= 8 ? orientation : 1
  }

  return 1
}

/**
 * Read the EXIF orientation without decoding pixels. JPEGs with orientation 1
 * (or no EXIF) can be embedded in a PDF byte-for-byte instead of re-encoded.
 */
export const jpegOrientation = (input: Uint8Array): number => {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    return 1
  }

  let offset = 2

  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) {
      offset++
      continue
    }

    const marker = input[offset + 1]!

    if (marker === 0xff) {
      offset++
      continue
    }

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }

    if (marker === 0xda || marker === 0xd9) {
      break
    }

    const length = (input[offset + 2]! << 8) | input[offset + 3]!

    if (length < 2) {
      break
    }

    const segmentEnd = offset + 2 + length

    if (segmentEnd > input.length) {
      break
    }

    if (
      marker === 0xe1 &&
      length >= 8 &&
      input[offset + 4] === 0x45 &&
      input[offset + 5] === 0x78 &&
      input[offset + 6] === 0x69 &&
      input[offset + 7] === 0x66 &&
      input[offset + 8] === 0 &&
      input[offset + 9] === 0
    ) {
      return readTiffOrientation(input, offset + 10, segmentEnd)
    }

    offset = segmentEnd
  }

  return 1
}
