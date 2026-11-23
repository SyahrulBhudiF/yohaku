import { beforeAll, test } from "vitest"

import { processImagesToPdf } from "@/features/image-tools/process"
import type { ImagePdfFileEntry } from "@/features/image-tools/store"
import { initImageCodecs, makePng } from "../../support/image-codecs"

const IMAGE_COUNT = 10

const options = (name: string) => ({
  time: 2_000,
  warmupTime: 0,
  iterations: 3,
  writeResult: `.amp/in/bench-image-pdf-${name}.json`,
})

const entry = (file: File, index: number): ImagePdfFileEntry => ({
  id: `${index}`,
  file,
  name: file.name,
  size: file.size,
  previewUrl: "",
})

let pngFiles: ReadonlyArray<ImagePdfFileEntry>
let jpegFiles: ReadonlyArray<ImagePdfFileEntry>

beforeAll(async () => {
  await initImageCodecs()

  const png = await makePng(1200, 800)
  const decode = (await import("@jsquash/png/decode")).default
  const encode = (await import("@jsquash/jpeg/encode")).default
  const image = await decode(png.buffer)

  if (!image) {
    throw new Error("Could not decode the benchmark PNG.")
  }

  const jpeg = new Uint8Array(await encode(image, { quality: 85 }))
  const pngFile = new File([png], "image.png", { type: "image/png" })
  const jpegFile = new File([jpeg], "image.jpg", { type: "image/jpeg" })

  pngFiles = Array.from({ length: IMAGE_COUNT }, (_, index) => entry(pngFile, index))
  jpegFiles = Array.from({ length: IMAGE_COUNT }, (_, index) => entry(jpegFile, index))
}, 60_000)

test("builds PDFs from ten images", { timeout: 240_000 }, async ({ bench }) => {
  await bench.compare(
    bench("10 png · one PDF", options("png"), () =>
      processImagesToPdf({ files: pngFiles, mode: "one", pageSize: "fit", quality: 90 }),
    ),
    bench("10 jpeg · one PDF", options("jpeg"), () =>
      processImagesToPdf({ files: jpegFiles, mode: "one", pageSize: "fit", quality: 90 }),
    ),
  )
})
