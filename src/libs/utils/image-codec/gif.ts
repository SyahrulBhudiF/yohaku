export const decodeGif = async (buffer: ArrayBuffer): Promise<ImageData | null> => {
  const { decompressFrames, parseGIF } = await import("gifuct-js")
  const gif = parseGIF(buffer)
  const frame = decompressFrames(gif, true)[0]

  if (!frame) {
    return null
  }

  const { width, height } = gif.lsd
  const { left, top, width: frameWidth, height: frameHeight } = frame.dims
  const data = new Uint8ClampedArray(width * height * 4)

  // A single-frame GIF covers the canvas: copy the contiguous patch in one
  // pass instead of walking pixels.
  if (left === 0 && top === 0 && frameWidth === width && frameHeight === height) {
    data.set(frame.patch)

    return new ImageData(data, width, height)
  }

  for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const source = (y * frameWidth + x) * 4
      const alpha = frame.patch[source + 3] ?? 0

      if (alpha === 0) {
        continue
      }

      const target = ((top + y) * width + (left + x)) * 4

      data[target] = frame.patch[source]!
      data[target + 1] = frame.patch[source + 1]!
      data[target + 2] = frame.patch[source + 2]!
      data[target + 3] = alpha
    }
  }

  return new ImageData(data, width, height)
}

export const encodeGif = async (
  image: ImageData,
  quality: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const loaded = await import("gifenc")
  // Vite resolves gifenc's ESM build; Node's CJS interop exposes it on `default`.
  const gifenc =
    typeof loaded.quantize === "function" ? loaded : (loaded.default as unknown as typeof loaded)
  const colors = Math.max(2, Math.min(256, Math.round((quality / 100) * 256)))
  // gifenc reads the typed array's whole backing buffer, so hand it a view
  // that starts at byte 0 and ends at the last pixel.
  const rgba =
    image.data.byteOffset === 0 && image.data.byteLength === image.data.buffer.byteLength
      ? image.data
      : new Uint8ClampedArray(image.data)
  const palette = gifenc.quantize(rgba, colors)
  const index = gifenc.applyPalette(rgba, palette, "rgb565")
  const gif = gifenc.GIFEncoder()

  gif.writeFrame(index, image.width, image.height, { palette })
  gif.finish()

  return gif.bytes() as Uint8Array<ArrayBuffer>
}
