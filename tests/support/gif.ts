export const makeAnimatedGif = async (frames = 3, width = 32, height = 32) => {
  const loaded = await import("gifenc")
  const gifenc =
    typeof loaded.quantize === "function" ? loaded : (loaded.default as unknown as typeof loaded)
  const gif = gifenc.GIFEncoder()
  const colors: ReadonlyArray<readonly [number, number, number]> = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
  ]

  for (let frame = 0; frame < frames; frame++) {
    const rgba = new Uint8ClampedArray(width * height * 4)
    const color = colors[frame % colors.length]!

    for (let index = 0; index < width * height; index++) {
      rgba[index * 4] = color[0]
      rgba[index * 4 + 1] = color[1]
      rgba[index * 4 + 2] = color[2]
      rgba[index * 4 + 3] = 255
    }

    const palette = gifenc.quantize(rgba, 8)
    const index = gifenc.applyPalette(rgba, palette, "rgb565")

    gif.writeFrame(index, width, height, { palette, delay: 100 })
  }

  gif.finish()

  return new Uint8Array(gif.bytes())
}

export interface WebpChunk {
  readonly fourcc: string
  readonly data: Uint8Array
}

export const parseWebpChunks = (bytes: Uint8Array): Array<WebpChunk> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: Array<WebpChunk> = []
  let offset = 12

  while (offset + 8 <= bytes.byteLength) {
    const fourcc = String.fromCharCode(
      bytes[offset]!,
      bytes[offset + 1]!,
      bytes[offset + 2]!,
      bytes[offset + 3]!,
    )
    const size = view.getUint32(offset + 4, true)
    const start = offset + 8

    chunks.push({ fourcc, data: bytes.subarray(start, start + size) })
    offset = start + size + (size & 1)
  }

  return chunks
}
