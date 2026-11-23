import { writeFileSync } from "node:fs"

import { assert } from "@effect/vitest"
import { Effect } from "effect"
import { beforeAll, test } from "vitest"

import { ImageProcessor } from "@/infrastructure/services/image-processor"
import type { ImageFormat } from "@/libs/schemas/image"
import { initImageCodecs } from "../../support/image-codecs"

// PDF to image uses the browser's native canvas encoder for PNG/JPEG.
// This measures the wasm codec path still used by WebP, AVIF, GIF and TIFF.
const WIDTH = 2480
const HEIGHT = 3508
const PAGE_COUNT = 50

let page: ImageData

const fillRect = (
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
  shade: number,
) => {
  for (let row = y; row < y + height; row++) {
    const start = (row * WIDTH + x) * 4

    for (let column = 0; column < width; column++) {
      const offset = start + column * 4

      data[offset] = shade
      data[offset + 1] = shade
      data[offset + 2] = shade
    }
  }
}

const encodePage = (format: ImageFormat) =>
  Effect.runPromise(
    Effect.provide(
      Effect.flatMap(ImageProcessor, (processor) => processor.encode(page, format, 90)),
      ImageProcessor.layer,
    ),
  )

const encodePages = async (format: ImageFormat) => {
  let bytes = 0

  for (let index = 0; index < PAGE_COUNT; index++) {
    bytes += (await encodePage(format)).byteLength
  }

  return bytes
}

beforeAll(async () => {
  await initImageCodecs()

  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)

  data.fill(255)
  fillRect(data, 120, 100, WIDTH - 240, 90, 40)

  for (let line = 0; line < 32; line++) {
    fillRect(data, 120, 280 + line * 90, WIDTH - 240 - (line % 8) * 80, 22, 80)
  }

  page = new ImageData(data, WIDTH, HEIGHT)
}, 60_000)

test("wasm-encodes 50 A4 pages at 300 DPI", { timeout: 600_000 }, async () => {
  const pngStart = performance.now()

  const pngBytes = await encodePages("png")

  const pngMs = performance.now() - pngStart
  const jpegStart = performance.now()

  const jpegBytes = await encodePages("jpeg")

  const jpegMs = performance.now() - jpegStart

  assert.isTrue(pngBytes > 0)
  assert.isTrue(jpegBytes > 0)
  writeFileSync(
    ".amp/in/bench-pdf-image-50.json",
    JSON.stringify(
      {
        pages: PAGE_COUNT,
        width: WIDTH,
        height: HEIGHT,
        pngMs,
        pngBytes,
        jpegMs,
        jpegBytes,
        note: "wasm codec baseline; PDF to image uses native canvas encoding for PNG/JPEG",
      },
      null,
      2,
    ),
  )
})
