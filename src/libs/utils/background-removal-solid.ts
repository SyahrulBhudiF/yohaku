import { ImageProcessingError } from "@/infrastructure/errors/image"

import { decodeImageData } from "./image-decode"
import { removeBackgroundWasm } from "./background-removal-wasm"

const MAX_SIDE = 4096
const EDGE_SAMPLE_BUDGET = 2048
const MIN_LOW = 8
const MAX_LOW = 40
const RANGE = 32

const channelMedian = (values: Uint8Array): number => {
  values.sort()

  return values[values.length >> 1] ?? 0
}

const sampleBackground = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): readonly [number, number, number] => {
  const step = Math.max(1, Math.floor((width + height) / EDGE_SAMPLE_BUDGET))
  const reds = new Uint8Array(Math.ceil((width * 2 + height * 2) / step) + 4)
  const greens = new Uint8Array(reds.length)
  const blues = new Uint8Array(reds.length)
  let count = 0

  const add = (x: number, y: number) => {
    const index = (y * width + x) * 4

    reds[count] = data[index] ?? 0
    greens[count] = data[index + 1] ?? 0
    blues[count] = data[index + 2] ?? 0
    count += 1
  }

  for (let x = 0; x < width; x += step) {
    add(x, 0)
    add(x, height - 1)
  }

  for (let y = step; y < height - step; y += step) {
    add(0, y)
    add(width - 1, y)
  }

  if (count === 0) {
    return [255, 255, 255]
  }

  return [
    channelMedian(reds.subarray(0, count)),
    channelMedian(greens.subarray(0, count)),
    channelMedian(blues.subarray(0, count)),
  ]
}

const backgroundNoise = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: readonly [number, number, number],
): number => {
  const step = Math.max(1, Math.floor((width + height) / EDGE_SAMPLE_BUDGET))
  const distances = new Uint8Array(Math.ceil((width * 2 + height * 2) / step) + 4)
  let count = 0

  const add = (x: number, y: number) => {
    const index = (y * width + x) * 4
    const red = (data[index] ?? 0) - background[0]
    const green = (data[index + 1] ?? 0) - background[1]
    const blue = (data[index + 2] ?? 0) - background[2]

    distances[count] = Math.min(255, Math.round(Math.hypot(red, green, blue)))
    count += 1
  }

  for (let x = 0; x < width; x += step) {
    add(x, 0)
    add(x, height - 1)
  }

  for (let y = step; y < height - step; y += step) {
    add(0, y)
    add(width - 1, y)
  }

  if (count === 0) {
    return MIN_LOW
  }

  distances.subarray(0, count).sort()

  const percentile = distances[Math.floor((count - 1) * 0.9)] ?? MIN_LOW

  return Math.min(MAX_LOW, Math.max(MIN_LOW, Math.round(percentile * 1.5 + 4)))
}

const canvasToPng = (canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> => {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/png" })
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)

        return
      }

      reject(new ImageProcessingError({ message: "Could not encode the transparent PNG." }))
    }, "image/png")
  })
}

const makeCanvas = (width: number, height: number): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height)
  }

  const canvas = document.createElement("canvas")

  canvas.width = width
  canvas.height = height

  return canvas
}

const applyJsMatte = (data: Uint8ClampedArray, width: number, height: number) => {
  const background = sampleBackground(data, width, height)
  const low = backgroundNoise(data, width, height, background)
  const high = low + RANGE
  const range = high - low
  const length = width * height
  const alphaPlane = new Uint8ClampedArray(length)

  for (let pixel = 0; pixel < length; pixel += 1) {
    const index = pixel * 4
    const red = data[index] ?? 0
    const green = data[index + 1] ?? 0
    const blue = data[index + 2] ?? 0
    const distance = Math.hypot(red - background[0], green - background[1], blue - background[2])
    const linear = (distance - low) / range
    const alpha = linear <= 0 ? 0 : linear >= 1 ? 1 : linear * linear * (3 - 2 * linear)

    alphaPlane[pixel] = Math.round(alpha * 255)
  }

  // A one-pixel box blur feathers the matte without touching the colour plane.
  const blurred = new Uint8ClampedArray(length)
  const rowStride = width

  for (let y = 0; y < height; y += 1) {
    const row = y * rowStride
    const previous = y > 0 ? row - rowStride : row
    const next = y < height - 1 ? row + rowStride : row

    for (let x = 0; x < width; x += 1) {
      const left = x > 0 ? x - 1 : x
      const right = x < width - 1 ? x + 1 : x
      const sum =
        (alphaPlane[previous + left] ?? 0) +
        (alphaPlane[previous + x] ?? 0) +
        (alphaPlane[previous + right] ?? 0) +
        (alphaPlane[row + left] ?? 0) +
        (alphaPlane[row + x] ?? 0) +
        (alphaPlane[row + right] ?? 0) +
        (alphaPlane[next + left] ?? 0) +
        (alphaPlane[next + x] ?? 0) +
        (alphaPlane[next + right] ?? 0)

      blurred[row + x] = sum / 9
    }
  }

  for (let pixel = 0; pixel < length; pixel += 1) {
    const index = pixel * 4
    const alpha = (blurred[pixel] ?? 0) / 255

    if (alpha <= 0.01) {
      data[index + 3] = 0

      continue
    }

    if (alpha < 0.95) {
      const inverse = 1 - alpha

      data[index] = ((data[index] ?? 0) - inverse * background[0]) / alpha
      data[index + 1] = ((data[index + 1] ?? 0) - inverse * background[1]) / alpha
      data[index + 2] = ((data[index + 2] ?? 0) - inverse * background[2]) / alpha
    }

    data[index + 3] = Math.round(alpha * (data[index + 3] ?? 255))
  }
}

/**
 * Removes a uniform studio background without a model. The Rust/WASM matte is
 * used when available; the JS matte is the fallback.
 */
export const removeSolidBackground = async (file: File): Promise<Blob> => {
  const image = await decodeImageData(file, MAX_SIDE)

  if (!image) {
    throw new ImageProcessingError({ message: "Could not read this image in this browser." })
  }

  const { data, width, height } = image
  const wasmPixels = await removeBackgroundWasm(data, width, height)

  if (wasmPixels) {
    data.set(wasmPixels)
  } else {
    applyJsMatte(data, width, height)
  }

  const canvas = makeCanvas(width, height)
  const context = canvas.getContext("2d")

  if (!context) {
    throw new ImageProcessingError({ message: "Could not create the transparent PNG." })
  }

  // Canvas ImageData requires an ArrayBuffer-backed view; normalize the
  // decoded buffer once at this boundary.
  const pixels = new Uint8ClampedArray(data)

  context.putImageData(new ImageData(pixels, width, height), 0, 0)

  return canvasToPng(canvas)
}
