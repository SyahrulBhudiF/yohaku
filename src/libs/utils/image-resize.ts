import type { CropRect, ImageCropAspect, ImageResizeMode } from "@/libs/schemas/image"

export interface ResizeOptions {
  readonly width: number
  readonly height: number
  readonly mode: ImageResizeMode
  readonly crop: CropRect
  readonly rotate: 0 | 90 | 180 | 270
  readonly flipX: boolean
  readonly flipY: boolean
}

export type CropHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

export const CROP_ASPECT: Record<ImageCropAspect, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
}

export const MIN_CROP_SIZE = 0.02

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const positive = (value: number) => Math.max(1, Math.round(value))

export const clampCropRect = (rect: CropRect): CropRect => {
  const width = clamp(Number.isFinite(rect.width) ? rect.width : 1, MIN_CROP_SIZE, 1)
  const height = clamp(Number.isFinite(rect.height) ? rect.height : 1, MIN_CROP_SIZE, 1)

  return {
    x: clamp(Number.isFinite(rect.x) ? rect.x : 0, 0, 1 - width),
    y: clamp(Number.isFinite(rect.y) ? rect.y : 0, 0, 1 - height),
    width,
    height,
  }
}

/** Largest centered crop with the requested pixel aspect. */
export const cropRectForAspect = (
  aspect: number | null,
  sourceWidth: number,
  sourceHeight: number,
): CropRect => {
  if (aspect === null) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  const normalized = aspect / (sourceWidth / sourceHeight)

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  const width = normalized >= 1 ? 1 : normalized
  const height = normalized >= 1 ? 1 / normalized : 1

  return {
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  }
}

export const moveCropRect = (start: CropRect, dx: number, dy: number): CropRect => ({
  ...start,
  x: clamp(start.x + dx, 0, 1 - start.width),
  y: clamp(start.y + dy, 0, 1 - start.height),
})

/** Resizes one or two edges, preserving the requested aspect when set. */
export const resizeCropRect = (
  start: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  aspect: number | null,
  sourceAspect: number,
): CropRect => {
  const west = handle.includes("w")
  const east = handle.includes("e")
  const north = handle.includes("n")
  const south = handle.includes("s")
  const right = start.x + start.width
  const bottom = start.y + start.height
  let left = start.x
  let top = start.y
  let nextRight = right
  let nextBottom = bottom

  if (west) left = clamp(start.x + dx, 0, right - MIN_CROP_SIZE)
  if (east) nextRight = clamp(right + dx, left + MIN_CROP_SIZE, 1)
  if (north) top = clamp(start.y + dy, 0, bottom - MIN_CROP_SIZE)
  if (south) nextBottom = clamp(bottom + dy, top + MIN_CROP_SIZE, 1)

  let width = nextRight - left
  let height = nextBottom - top

  if (aspect !== null) {
    const normalized = aspect / sourceAspect

    if ((east || west) && (north || south)) {
      height = width / normalized

      const maxHeight = north ? bottom : 1 - top

      if (height > maxHeight) {
        height = maxHeight
        width = height * normalized
      }

      const maxWidth = west ? right : 1 - left

      if (width > maxWidth) {
        width = maxWidth
        height = width / normalized
      }

      left = west ? right - width : left
      top = north ? bottom - height : top
    } else if (east || west) {
      height = width / normalized

      if (height > 1) {
        height = 1
        width = height * normalized
      }

      left = west ? right - width : left
      top = clamp(start.y + (start.height - height) / 2, 0, 1 - height)
    } else {
      width = height * normalized

      if (width > 1) {
        width = 1
        height = width / normalized
      }

      top = north ? bottom - height : top
      left = clamp(start.x + (start.width - width) / 2, 0, 1 - width)
    }
  }

  return clampCropRect({ x: left, y: top, width, height })
}

export interface ResizeGeometry {
  readonly cropX: number
  readonly cropY: number
  readonly cropWidth: number
  readonly cropHeight: number
  readonly rotatedWidth: number
  readonly rotatedHeight: number
  readonly mapX: number
  readonly mapY: number
  readonly mapWidth: number
  readonly mapHeight: number
  readonly outputWidth: number
  readonly outputHeight: number
}

/** Resolves the crop, rotation, and output box into integer pixel geometry. */
export const computeResizeGeometry = (
  sourceWidth: number,
  sourceHeight: number,
  options: ResizeOptions,
): ResizeGeometry => {
  const width = positive(sourceWidth)
  const height = positive(sourceHeight)
  const rect = clampCropRect(options.crop)
  const cropX = Math.min(width - 1, Math.round(rect.x * width))
  const cropY = Math.min(height - 1, Math.round(rect.y * height))
  const cropWidth = Math.max(1, Math.min(width - cropX, Math.round(rect.width * width)))
  const cropHeight = Math.max(1, Math.min(height - cropY, Math.round(rect.height * height)))
  const rotatedWidth = options.rotate % 180 === 0 ? cropWidth : cropHeight
  const rotatedHeight = options.rotate % 180 === 0 ? cropHeight : cropWidth
  const boxWidth = positive(options.width)
  const boxHeight = positive(options.height)

  if (options.mode === "fit") {
    const scale = Math.min(boxWidth / rotatedWidth, boxHeight / rotatedHeight)

    return {
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      rotatedWidth,
      rotatedHeight,
      mapX: 0,
      mapY: 0,
      mapWidth: rotatedWidth,
      mapHeight: rotatedHeight,
      outputWidth: positive(rotatedWidth * scale),
      outputHeight: positive(rotatedHeight * scale),
    }
  }

  if (options.mode === "stretch") {
    return {
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      rotatedWidth,
      rotatedHeight,
      mapX: 0,
      mapY: 0,
      mapWidth: rotatedWidth,
      mapHeight: rotatedHeight,
      outputWidth: boxWidth,
      outputHeight: boxHeight,
    }
  }

  const targetAspect = boxWidth / boxHeight
  let mapX = 0
  let mapY = 0
  let mapWidth = rotatedWidth
  let mapHeight = rotatedHeight

  if (rotatedWidth / rotatedHeight > targetAspect) {
    mapWidth = positive(rotatedHeight * targetAspect)
    mapX = Math.floor((rotatedWidth - mapWidth) / 2)
  } else {
    mapHeight = positive(rotatedWidth / targetAspect)
    mapY = Math.floor((rotatedHeight - mapHeight) / 2)
  }

  return {
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    rotatedWidth,
    rotatedHeight,
    mapX,
    mapY,
    mapWidth,
    mapHeight,
    outputWidth: boxWidth,
    outputHeight: boxHeight,
  }
}

/** Bilinear resize over flat RGBA buffers; no per-pixel allocations. */
export const resizeImageData = (source: ImageData, options: ResizeOptions): ImageData => {
  const geometry = computeResizeGeometry(source.width, source.height, options)
  const {
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    mapX,
    mapY,
    mapWidth,
    mapHeight,
    outputWidth,
    outputHeight,
  } = geometry
  const sourcePixels = source.data
  const output = new ImageData(
    new Uint8ClampedArray(outputWidth * outputHeight * 4),
    outputWidth,
    outputHeight,
  )
  const target = output.data
  const sourceStride = source.width
  const scaleX = mapWidth / outputWidth
  const scaleY = mapHeight / outputHeight
  const maxX = cropX + cropWidth - 1
  const maxY = cropY + cropHeight - 1

  for (let y = 0; y < outputHeight; y++) {
    const mappedY = mapY + (y + 0.5) * scaleY - 0.5
    const flippedY = options.flipY ? 2 * mapY + mapHeight - 1 - mappedY : mappedY

    for (let x = 0; x < outputWidth; x++) {
      const mappedX = mapX + (x + 0.5) * scaleX - 0.5
      const flippedX = options.flipX ? 2 * mapX + mapWidth - 1 - mappedX : mappedX
      let sourceX: number
      let sourceY: number

      switch (options.rotate) {
        case 90:
          sourceX = flippedY
          sourceY = cropHeight - 1 - flippedX
          break
        case 180:
          sourceX = cropWidth - 1 - flippedX
          sourceY = cropHeight - 1 - flippedY
          break
        case 270:
          sourceX = cropWidth - 1 - flippedY
          sourceY = flippedX
          break
        default:
          sourceX = flippedX
          sourceY = flippedY
      }

      sourceX += cropX
      sourceY += cropY

      const left = Math.max(cropX, Math.min(maxX, Math.floor(sourceX)))
      const top = Math.max(cropY, Math.min(maxY, Math.floor(sourceY)))
      const right = Math.min(maxX, left + 1)
      const bottom = Math.min(maxY, top + 1)
      const fx = sourceX - left
      const fy = sourceY - top
      const topLeft = (top * sourceStride + left) * 4
      const topRight = (top * sourceStride + right) * 4
      const bottomLeft = (bottom * sourceStride + left) * 4
      const bottomRight = (bottom * sourceStride + right) * 4
      const out = (y * outputWidth + x) * 4

      for (let channel = 0; channel < 4; channel++) {
        const upper =
          sourcePixels[topLeft + channel]! * (1 - fx) + sourcePixels[topRight + channel]! * fx
        const lower =
          sourcePixels[bottomLeft + channel]! * (1 - fx) + sourcePixels[bottomRight + channel]! * fx

        target[out + channel] = upper * (1 - fy) + lower * fy + 0.5
      }
    }
  }

  return output
}

/** Downscales an image so neither side exceeds `maxSide`; returns the input when it fits. */
export const fitImageDataWithin = (image: ImageData, maxSide: number): ImageData => {
  const longest = Math.max(image.width, image.height)

  if (longest <= maxSide) {
    return image
  }

  const scale = maxSide / longest

  return resizeImageData(image, {
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
    mode: "stretch",
    crop: { x: 0, y: 0, width: 1, height: 1 },
    rotate: 0,
    flipX: false,
    flipY: false,
  })
}

/** JPEG has no alpha channel; composite transparent pixels onto white first. */
export const flattenOnWhite = (image: ImageData) => {
  const data = image.data

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]! / 255

    if (alpha === 1) continue

    data[index] = data[index]! * alpha + 255 * (1 - alpha)
    data[index + 1] = data[index + 1]! * alpha + 255 * (1 - alpha)
    data[index + 2] = data[index + 2]! * alpha + 255 * (1 - alpha)
    data[index + 3] = 255
  }
}
