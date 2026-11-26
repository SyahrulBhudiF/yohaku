import { assert, describe, it } from "@effect/vitest"

import { stripImageMetadata } from "@/libs/utils/image-metadata"

const crcTable = (() => {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index++) {
    let value = index

    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }

    table[index] = value >>> 0
  }

  return table
})()

const crc32 = (bytes: Uint8Array) => {
  let value = 0xffffffff

  for (const byte of bytes) {
    value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8)
  }

  return (value ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: Uint8Array) => {
  const typeBytes = new TextEncoder().encode(type)
  const output = new Uint8Array(12 + data.length)
  const view = new DataView(output.buffer)

  view.setUint32(0, data.length)
  output.set(typeBytes, 4)
  output.set(data, 8)
  view.setUint32(8 + data.length, crc32(output.subarray(4, 8 + data.length)))

  return output
}

const concat = (parts: ReadonlyArray<Uint8Array>) => {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const output = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }

  return output
}

const png = (extra: ReadonlyArray<Uint8Array>) =>
  concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    ...extra,
    chunk("IDAT", new Uint8Array([1, 2, 3])),
    chunk("IEND", new Uint8Array()),
  ])

const jpegWithExif = () => {
  const tiff = new Uint8Array(32)

  tiff[0] = 0x49
  tiff[1] = 0x49
  tiff[2] = 0x2a
  tiff[3] = 0
  tiff[4] = 8
  tiff[8] = 1
  tiff[10] = 0x0f
  tiff[11] = 0x01
  tiff[12] = 2
  tiff[14] = 6
  tiff[18] = 26
  tiff.set(new TextEncoder().encode("Canon\0"), 26)

  const payload = concat([new TextEncoder().encode("Exif\0\0"), tiff])
  const app1 = new Uint8Array(4 + payload.length)

  app1[0] = 0xff
  app1[1] = 0xe1
  app1[2] = (payload.length + 2) >> 8
  app1[3] = (payload.length + 2) & 0xff
  app1.set(payload, 4)

  return concat([
    new Uint8Array([0xff, 0xd8]),
    app1,
    new Uint8Array([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9]),
  ])
}

describe("stripImageMetadata", () => {
  it("removes PNG text chunks and reports their contents", () => {
    const text = new TextEncoder().encode("Author\0Ada")
    const input = png([chunk("tEXt", text)])
    const result = stripImageMetadata(input)

    assert.isNotNull(result)

    if (!result) return

    assert.strictEqual(result.report.removedBytes, 12 + text.length)
    assert.deepEqual(result.report.fields, [{ label: "Text: Author", value: "Ada" }])
    assert.notInclude(new TextDecoder().decode(result.data), "tEXt")
    assert.include(new TextDecoder().decode(result.data), "IDAT")
  })

  it("removes JPEG EXIF while preserving scan bytes", () => {
    const input = jpegWithExif()
    const result = stripImageMetadata(input)

    assert.isNotNull(result)

    if (!result) return

    assert.deepEqual(result.report.fields, [{ label: "Camera make", value: "Canon" }])
    assert.deepEqual(Array.from(result.data.slice(0, 2)), [0xff, 0xd8])
    assert.deepEqual(Array.from(result.data.slice(2, 4)), [0xff, 0xda])
    assert.include(Array.from(result.data), 0x11)
    assert.include(Array.from(result.data), 0x33)
    assert.notInclude(new TextDecoder().decode(result.data), "Exif")
  })

  it("returns the original bytes when there is no metadata", () => {
    const input = png([])
    const result = stripImageMetadata(input)

    assert.isNotNull(result)

    if (!result) return

    assert.strictEqual(result.report.removedBytes, 0)
    assert.deepEqual(result.report.fields, [])
    assert.deepEqual(result.data, input)
  })
})
