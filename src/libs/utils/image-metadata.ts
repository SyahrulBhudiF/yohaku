export type MetadataFormat = "jpeg" | "png"

export interface MetadataField {
  readonly label: string
  readonly value: string
}

export interface MetadataReport {
  readonly format: MetadataFormat
  readonly fields: ReadonlyArray<MetadataField>
  readonly removedBytes: number
}

export interface StripMetadataResult {
  readonly data: Uint8Array<ArrayBuffer>
  readonly report: MetadataReport
}

const MAX_FIELD_VALUE = 180
const JPEG_SOI = [0xff, 0xd8] as const
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

const startsWith = (bytes: Uint8Array, prefix: ReadonlyArray<number>) =>
  bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value)

const ascii = (bytes: Uint8Array, start: number, length: number) => {
  const end = Math.min(bytes.length, start + length)
  let text = ""

  for (let index = start; index < end && bytes[index] !== 0; index++) {
    text += String.fromCharCode(bytes[index]!)
  }

  return text
}

const readU16 = (bytes: Uint8Array, offset: number, littleEndian: boolean) => {
  if (offset + 2 > bytes.length) return 0

  return littleEndian
    ? bytes[offset]! | (bytes[offset + 1]! << 8)
    : (bytes[offset]! << 8) | bytes[offset + 1]!
}

const readU32 = (bytes: Uint8Array, offset: number, littleEndian: boolean) => {
  if (offset + 4 > bytes.length) return 0

  return littleEndian
    ? (bytes[offset]! |
        (bytes[offset + 1]! << 8) |
        (bytes[offset + 2]! << 16) |
        (bytes[offset + 3]! << 24)) >>>
        0
    : ((bytes[offset]! << 24) |
        (bytes[offset + 1]! << 16) |
        (bytes[offset + 2]! << 8) |
        bytes[offset + 3]!) >>>
        0
}

const truncate = (value: string) =>
  value.length > MAX_FIELD_VALUE ? `${value.slice(0, MAX_FIELD_VALUE - 1)}…` : value

const addField = (fields: Array<MetadataField>, label: string, value: string) => {
  const clean = value.trim()

  if (!clean) return
  if (fields.some((field) => field.label === label && field.value === clean)) return

  fields.push({ label, value: truncate(clean) })
}

const TIFF_TAGS: Record<number, string> = {
  0x010f: "Camera make",
  0x0110: "Camera model",
  0x0131: "Software",
  0x0132: "Modified",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x9003: "Taken",
  0x9004: "Digitized",
  0xa002: "Pixel width",
  0xa003: "Pixel height",
}

const GPS_TAGS: Record<number, string> = {
  0x0001: "GPS latitude ref",
  0x0002: "GPS latitude",
  0x0003: "GPS longitude ref",
  0x0004: "GPS longitude",
  0x0005: "GPS altitude ref",
  0x0006: "GPS altitude",
  0x0007: "GPS time",
  0x001d: "GPS date",
}

const typeSize = (type: number) => {
  switch (type) {
    case 1:
    case 2:
    case 6:
    case 7:
      return 1
    case 3:
    case 8:
      return 2
    case 4:
    case 9:
    case 11:
      return 4
    case 5:
    case 10:
    case 12:
      return 8
    default:
      return 0
  }
}

interface TiffReader {
  readonly bytes: Uint8Array
  readonly littleEndian: boolean
  readonly visited: Set<number>
  readonly fields: Array<MetadataField>
}

const entryValueOffset = (reader: TiffReader, entry: number, count: number, size: number) => {
  const total = count * size

  if (total <= 4) {
    return entry + 8
  }

  return readU32(reader.bytes, entry + 8, reader.littleEndian)
}

const readRational = (reader: TiffReader, offset: number) => {
  const numerator = readU32(reader.bytes, offset, reader.littleEndian)
  const denominator = readU32(reader.bytes, offset + 4, reader.littleEndian)

  return denominator === 0 ? 0 : numerator / denominator
}

const readAsciiValue = (reader: TiffReader, entry: number, count: number) => {
  const offset = entryValueOffset(reader, entry, count, 1)

  return ascii(reader.bytes, offset, count)
}

const readNumbers = (reader: TiffReader, entry: number, type: number, count: number) => {
  const size = typeSize(type)
  const offset = entryValueOffset(reader, entry, count, size)
  const values: Array<number> = []

  for (let index = 0; index < Math.min(count, 8); index++) {
    const at = offset + index * size

    if (type === 3) {
      values.push(readU16(reader.bytes, at, reader.littleEndian))
    } else if (type === 4) {
      values.push(readU32(reader.bytes, at, reader.littleEndian))
    } else if (type === 5) {
      values.push(readRational(reader, at))
    } else if (type === 1 || type === 7) {
      values.push(reader.bytes[at] ?? 0)
    }
  }

  return values
}

const formatCoordinate = (values: ReadonlyArray<number>, reference: string) => {
  if (values.length < 3) return ""

  const decimal = values[0]! + values[1]! / 60 + values[2]! / 3600
  const signed =
    reference.toUpperCase() === "S" || reference.toUpperCase() === "W" ? -decimal : decimal

  return `${signed.toFixed(6)}°`
}

const parseGps = (reader: TiffReader, offset: number) => {
  if (reader.visited.has(offset)) return

  reader.visited.add(offset)

  const count = readU16(reader.bytes, offset, reader.littleEndian)
  let latitudeRef = ""
  let longitudeRef = ""
  let latitude: Array<number> = []
  let longitude: Array<number> = []
  let altitude: Array<number> = []

  for (let index = 0; index < count; index++) {
    const entry = offset + 2 + index * 12
    const tag = readU16(reader.bytes, entry, reader.littleEndian)
    const type = readU16(reader.bytes, entry + 2, reader.littleEndian)
    const length = readU32(reader.bytes, entry + 4, reader.littleEndian)

    if (tag === 0x0001) latitudeRef = readAsciiValue(reader, entry, length)
    else if (tag === 0x0003) longitudeRef = readAsciiValue(reader, entry, length)
    else if (tag === 0x0002) latitude = readNumbers(reader, entry, type, length)
    else if (tag === 0x0004) longitude = readNumbers(reader, entry, type, length)
    else if (tag === 0x0006) altitude = readNumbers(reader, entry, type, length)
    else if (tag === 0x001d)
      addField(reader.fields, GPS_TAGS[tag]!, readAsciiValue(reader, entry, length))
  }

  const lat = formatCoordinate(latitude, latitudeRef)
  const lon = formatCoordinate(longitude, longitudeRef)

  if (lat) addField(reader.fields, "GPS latitude", lat)
  if (lon) addField(reader.fields, "GPS longitude", lon)
  if (altitude.length > 0) addField(reader.fields, "GPS altitude", `${altitude[0]!.toFixed(1)} m`)
}

const parseTiff = (tiff: Uint8Array, fields: Array<MetadataField>) => {
  if (tiff.length < 8) return

  const order = String.fromCharCode(tiff[0]!, tiff[1]!)
  const littleEndian = order === "II"

  if (!littleEndian && order !== "MM") return
  if (readU16(tiff, 2, littleEndian) !== 42) return

  const reader: TiffReader = { bytes: tiff, littleEndian, visited: new Set(), fields }
  const parseIfd = (offset: number) => {
    if (offset <= 0 || offset + 2 > tiff.length || reader.visited.has(offset)) return

    reader.visited.add(offset)

    const count = readU16(tiff, offset, littleEndian)
    let exifOffset = 0
    let gpsOffset = 0

    for (let index = 0; index < count; index++) {
      const entry = offset + 2 + index * 12

      if (entry + 12 > tiff.length) break

      const tag = readU16(tiff, entry, littleEndian)
      const type = readU16(tiff, entry + 2, littleEndian)
      const length = readU32(tiff, entry + 4, littleEndian)

      if (tag === 0x8769) {
        exifOffset = readU32(tiff, entry + 8, littleEndian)
        continue
      }

      if (tag === 0x8825) {
        gpsOffset = readU32(tiff, entry + 8, littleEndian)
        continue
      }

      const label = TIFF_TAGS[tag]

      if (!label) continue

      if (type === 2) {
        addField(fields, label, readAsciiValue(reader, entry, length))
      } else if (type === 3 || type === 4) {
        const values = readNumbers(reader, entry, type, length)

        if (values.length > 0) addField(fields, label, String(values[0]))
      }
    }

    if (exifOffset > 0) parseIfd(exifOffset)
    if (gpsOffset > 0) parseGps(reader, gpsOffset)
  }

  parseIfd(readU32(tiff, 4, littleEndian))
}

const jpegMetadata = (payload: Uint8Array, marker: number, fields: Array<MetadataField>) => {
  if (marker === 0xe1) {
    if (startsWith(payload, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00])) {
      parseTiff(payload.subarray(6), fields)

      if (fields.length === 0) addField(fields, "EXIF", "Embedded camera metadata")
    } else if (ascii(payload, 0, 29).includes("http://ns.adobe.com/xap/1.0/")) {
      addField(fields, "XMP", "Embedded Adobe XMP metadata")
    } else {
      addField(fields, "APP1", "Embedded metadata")
    }

    return
  }

  if (marker === 0xed) {
    addField(fields, "IPTC", "Embedded Photoshop/IPTC metadata")

    return
  }

  if (marker === 0xfe) {
    addField(fields, "Comment", ascii(payload, 0, payload.length))
  }
}

const stripJpeg = (bytes: Uint8Array): StripMetadataResult | null => {
  if (!startsWith(bytes, JPEG_SOI)) return null

  const parts: Array<Uint8Array> = [bytes.subarray(0, 2)]
  const fields: Array<MetadataField> = []
  let removedBytes = 0
  let index = 2
  let sawEnd = false

  while (index < bytes.length) {
    if (bytes[index] !== 0xff) return null

    const markerStart = index

    while (index < bytes.length && bytes[index] === 0xff) index++

    if (index >= bytes.length) return null

    const marker = bytes[index]!
    const afterMarker = index + 1

    if (marker === 0xd9) {
      parts.push(bytes.subarray(markerStart, afterMarker))
      sawEnd = true
      break
    }

    if (marker === 0xda) {
      parts.push(bytes.subarray(markerStart))
      sawEnd = true
      break
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(markerStart, afterMarker))
      index = afterMarker
      continue
    }

    if (afterMarker + 2 > bytes.length) return null

    const length = (bytes[afterMarker]! << 8) | bytes[afterMarker + 1]!
    const segmentEnd = afterMarker + length

    if (length < 2 || segmentEnd > bytes.length) return null

    const isApp = marker >= 0xe0 && marker <= 0xef
    const payload = bytes.subarray(afterMarker + 2, segmentEnd)
    const keep =
      marker === 0xe0 ||
      marker === 0xee ||
      (marker === 0xe2 && ascii(payload, 0, 12) === "ICC_PROFILE")

    if (isApp && !keep) {
      jpegMetadata(payload, marker, fields)
      removedBytes += segmentEnd - markerStart
    } else if (marker === 0xfe) {
      jpegMetadata(payload, marker, fields)
      removedBytes += segmentEnd - markerStart
    } else {
      parts.push(bytes.subarray(markerStart, segmentEnd))
    }

    index = segmentEnd
  }

  if (!sawEnd) return null

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const data = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    data.set(part, offset)
    offset += part.byteLength
  }

  return {
    data,
    report: { format: "jpeg", fields, removedBytes },
  }
}

const pngTextFields = (type: string, data: Uint8Array, fields: Array<MetadataField>) => {
  if (type === "tEXt") {
    const separator = data.indexOf(0)

    if (separator < 0) return

    const keyword = ascii(data, 0, separator)
    const text = new TextDecoder("latin1").decode(data.subarray(separator + 1))

    addField(fields, `Text: ${keyword || "untitled"}`, text)

    return
  }

  if (type === "zTXt") {
    const separator = data.indexOf(0)

    if (separator < 0) return

    addField(fields, `Compressed text: ${ascii(data, 0, separator)}`, "Compressed PNG text")

    return
  }

  if (type === "iTXt") {
    const keywordEnd = data.indexOf(0)

    if (keywordEnd < 0 || keywordEnd + 3 > data.length) return

    const keyword = ascii(data, 0, keywordEnd)
    const compressed = data[keywordEnd + 1] === 1
    const languageEnd = data.indexOf(0, keywordEnd + 3)

    if (languageEnd < 0) return

    const translatedEnd = data.indexOf(0, languageEnd + 1)

    if (translatedEnd < 0) return

    const text = compressed
      ? "Compressed international text"
      : new TextDecoder().decode(data.subarray(translatedEnd + 1))

    addField(fields, `Text: ${keyword || "untitled"}`, text)

    return
  }

  if (type === "tIME" && data.length >= 7) {
    const year = (data[0]! << 8) | data[1]!
    const month = String(data[2]!).padStart(2, "0")
    const day = String(data[3]!).padStart(2, "0")
    const hour = String(data[4]!).padStart(2, "0")
    const minute = String(data[5]!).padStart(2, "0")
    const second = String(data[6]!).padStart(2, "0")

    addField(fields, "Modified", `${year}-${month}-${day} ${hour}:${minute}:${second}`)

    return
  }

  if (type === "eXIf") {
    parseTiff(data, fields)

    if (fields.length === 0) addField(fields, "EXIF", "Embedded camera metadata")
  }
}

const stripPng = (bytes: Uint8Array): StripMetadataResult | null => {
  if (!startsWith(bytes, PNG_SIGNATURE)) return null

  const parts: Array<Uint8Array> = [bytes.subarray(0, 8)]
  const fields: Array<MetadataField> = []
  const metadataTypes = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"])
  let removedBytes = 0
  let index = 8
  let sawEnd = false

  while (index + 12 <= bytes.length) {
    const length = readU32(bytes, index, false)
    const type = ascii(bytes, index + 4, 4)
    const chunkEnd = index + 12 + length

    if (chunkEnd > bytes.length) return null

    if (metadataTypes.has(type)) {
      pngTextFields(type, bytes.subarray(index + 8, index + 8 + length), fields)
      removedBytes += chunkEnd - index
    } else {
      parts.push(bytes.subarray(index, chunkEnd))
    }

    index = chunkEnd

    if (type === "IEND") {
      sawEnd = true
      break
    }
  }

  if (!sawEnd) return null

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const data = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    data.set(part, offset)
    offset += part.byteLength
  }

  return {
    data,
    report: { format: "png", fields, removedBytes },
  }
}

export const detectMetadataFormat = (bytes: Uint8Array): MetadataFormat | null => {
  if (startsWith(bytes, JPEG_SOI)) return "jpeg"
  if (startsWith(bytes, PNG_SIGNATURE)) return "png"

  return null
}

/**
 * Removes JPEG APP segments and PNG text chunks without touching the image
 * data. Returns null when the container is malformed or unsupported.
 */
export const stripImageMetadata = (bytes: Uint8Array): StripMetadataResult | null => {
  const format = detectMetadataFormat(bytes)

  if (format === "jpeg") return stripJpeg(bytes)
  if (format === "png") return stripPng(bytes)

  return null
}
