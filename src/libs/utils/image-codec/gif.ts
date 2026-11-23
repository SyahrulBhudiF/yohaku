import type { AnimatedImage, AnimationFrame } from "./animation"
import { isWithinAnimationLimits } from "./animation"

const toArrayBuffer = (input: Uint8Array): ArrayBuffer =>
  input.byteOffset === 0 && input.byteLength === input.buffer.byteLength
    ? (input.buffer as ArrayBuffer)
    : (input.slice().buffer as ArrayBuffer)

const fillBackground = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  color: { readonly 0: number; readonly 1: number; readonly 2: number } | undefined,
) => {
  if (!color) {
    return
  }

  for (let index = 0; index < width * height; index++) {
    data[index * 4] = color[0]
    data[index * 4 + 1] = color[1]
    data[index * 4 + 2] = color[2]
    data[index * 4 + 3] = 255
  }
}

const drawFrame = (
  target: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  frame: {
    readonly dims: {
      readonly left: number
      readonly top: number
      readonly width: number
      readonly height: number
    }
    readonly patch: Uint8ClampedArray
    readonly transparentIndex: number | undefined
  },
) => {
  const left = Math.max(0, frame.dims.left)
  const top = Math.max(0, frame.dims.top)
  const width = Math.min(frame.dims.width, canvasWidth - left)
  const height = Math.min(frame.dims.height, canvasHeight - top)

  if (width <= 0 || height <= 0) {
    return
  }

  const fullFrame = left === 0 && top === 0 && width === canvasWidth && height === canvasHeight

  if (fullFrame && frame.transparentIndex === undefined) {
    target.set(frame.patch)

    return
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * frame.dims.width + x) * 4
      const alpha = frame.patch[source + 3] ?? 0

      if (alpha === 0) {
        continue
      }

      const destination = ((top + y) * canvasWidth + (left + x)) * 4

      target[destination] = frame.patch[source]!
      target[destination + 1] = frame.patch[source + 1]!
      target[destination + 2] = frame.patch[source + 2]!
      target[destination + 3] = alpha
    }
  }
}

const clearFrame = (
  target: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  frame: {
    readonly dims: {
      readonly left: number
      readonly top: number
      readonly width: number
      readonly height: number
    }
  },
  background: { readonly 0: number; readonly 1: number; readonly 2: number } | undefined,
) => {
  const left = Math.max(0, frame.dims.left)
  const top = Math.max(0, frame.dims.top)
  const width = Math.min(frame.dims.width, canvasWidth - left)
  const height = Math.min(frame.dims.height, canvasHeight - top)

  if (width <= 0 || height <= 0) {
    return
  }

  const red = background?.[0] ?? 0
  const green = background?.[1] ?? 0
  const blue = background?.[2] ?? 0

  for (let y = 0; y < height; y++) {
    const start = ((top + y) * canvasWidth + left) * 4
    const end = start + width * 4

    for (let index = start; index < end; index += 4) {
      target[index] = red
      target[index + 1] = green
      target[index + 2] = blue
      target[index + 3] = 255
    }
  }
}

export const decodeGifAnimation = async (input: Uint8Array): Promise<AnimatedImage | null> => {
  const { decompressFrames, parseGIF } = await import("gifuct-js")
  const gif = parseGIF(toArrayBuffer(input))
  const frames = decompressFrames(gif, true)

  if (frames.length === 0) {
    return null
  }

  const width = gif.lsd.width
  const height = gif.lsd.height

  if (!isWithinAnimationLimits(width, height, frames.length)) {
    return null
  }

  const background = gif.gct?.[gif.lsd.backgroundColorIndex] as
    | { readonly 0: number; readonly 1: number; readonly 2: number }
    | undefined
  const canvas = new Uint8ClampedArray(width * height * 4)

  fillBackground(canvas, width, height, background)

  const previous = new Uint8ClampedArray(width * height * 4)
  const output: Array<AnimationFrame> = []

  for (const frame of frames) {
    const disposal = frame.disposalType ?? 0

    if (disposal === 3) {
      previous.set(canvas)
    }

    drawFrame(canvas, width, height, frame)

    output.push({
      image: new ImageData(new Uint8ClampedArray(canvas), width, height),
      delayMs: Math.max(10, frame.delay ?? 100),
    })

    if (disposal === 2) {
      clearFrame(canvas, width, height, frame, background)
    } else if (disposal === 3) {
      canvas.set(previous)
    }
  }

  return { width, height, frames: output }
}

export const encodeAnimatedWebp = async (
  animation: AnimatedImage,
  quality: number,
): Promise<Uint8Array<ArrayBuffer> | null> => {
  const { encodeAnimation } = await import("wasm-webp/dist/esm/index.js")
  const frames = animation.frames.map((frame) => ({
    data: new Uint8Array(
      frame.image.data.buffer,
      frame.image.data.byteOffset,
      frame.image.data.byteLength,
    ),
    duration: frame.delayMs,
    config: { lossless: 0, quality },
  }))
  const data = await encodeAnimation(animation.width, animation.height, true, frames)

  return data ? new Uint8Array(data) : null
}

export const encodeGifAnimation = async (
  animation: AnimatedImage,
  quality: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const loaded = await import("gifenc")
  const gifenc =
    typeof loaded.quantize === "function" ? loaded : (loaded.default as unknown as typeof loaded)
  const colors = Math.max(2, Math.min(256, Math.round((quality / 100) * 256)))
  const gif = gifenc.GIFEncoder()

  for (const [index, frame] of animation.frames.entries()) {
    const rgba = frame.image.data
    const palette = gifenc.quantize(rgba, colors)
    const indexed = gifenc.applyPalette(rgba, palette, "rgb565")

    gif.writeFrame(
      indexed,
      animation.width,
      animation.height,
      index === 0
        ? { palette, delay: frame.delayMs, repeat: 0 }
        : { palette, delay: frame.delayMs },
    )
  }

  gif.finish()

  return gif.bytes() as Uint8Array<ArrayBuffer>
}

export const transcodeGif = async (
  input: Uint8Array,
  format: "gif" | "webp",
  quality: number,
): Promise<Uint8Array<ArrayBuffer> | null> => {
  const animation = await decodeGifAnimation(input)

  if (!animation) {
    return null
  }

  return format === "webp"
    ? encodeAnimatedWebp(animation, quality)
    : encodeGifAnimation(animation, quality)
}

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
