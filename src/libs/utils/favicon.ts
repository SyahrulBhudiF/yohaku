import { resizeImageData } from "./image-resize"

export interface IcoImage {
  readonly size: number
  readonly png: Uint8Array
}

/**
 * Fits an image inside a transparent square without stretching it.
 * The result is always `size × size`, centered on both axes.
 */
export const fitImageOnSquare = (source: ImageData, size: number): ImageData => {
  const side = Math.max(1, Math.round(size))
  const scale = Math.min(side / source.width, side / source.height)
  const width = Math.max(1, Math.min(side, Math.round(source.width * scale)))
  const height = Math.max(1, Math.min(side, Math.round(source.height * scale)))
  const resized = resizeImageData(source, {
    width,
    height,
    mode: "stretch",
    crop: { x: 0, y: 0, width: 1, height: 1 },
    rotate: 0,
    flipX: false,
    flipY: false,
  })
  const square = new ImageData(new Uint8ClampedArray(side * side * 4), side, side)
  const offsetX = Math.floor((side - width) / 2)
  const offsetY = Math.floor((side - height) / 2)

  for (let y = 0; y < height; y++) {
    const from = y * width * 4
    const to = ((y + offsetY) * side + offsetX) * 4

    square.data.set(resized.data.subarray(from, from + width * 4), to)
  }

  return square
}

/** Builds a Windows icon container whose entries are PNG-compressed images. */
export const buildIco = (images: ReadonlyArray<IcoImage>): Uint8Array => {
  const headerSize = 6 + images.length * 16
  const total = headerSize + images.reduce((sum, image) => sum + image.png.byteLength, 0)
  const output = new Uint8Array(total)
  const view = new DataView(output.buffer)

  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, images.length, true)

  let offset = headerSize

  images.forEach((image, index) => {
    const entry = 6 + index * 16
    const dimension = image.size >= 256 ? 0 : image.size

    output[entry] = dimension
    output[entry + 1] = dimension
    view.setUint16(entry + 4, 1, true)
    view.setUint16(entry + 6, 32, true)
    view.setUint32(entry + 8, image.png.byteLength, true)
    view.setUint32(entry + 12, offset, true)
    output.set(image.png, offset)
    offset += image.png.byteLength
  })

  return output
}

export const fileBaseName = (name: string) =>
  name
    .replace(/\.[^./\\]+$/, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app"

export const buildWebManifest = (name: string) => {
  const safeName = name.trim() || "Yohaku app"

  return JSON.stringify(
    {
      name: safeName,
      short_name: safeName.slice(0, 12),
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      theme_color: "#ffffff",
      background_color: "#ffffff",
      display: "standalone",
    },
    null,
    2,
  )
}

export const buildFaviconSnippet = () =>
  [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
  ].join("\n")
