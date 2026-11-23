import { Effect } from "effect"
import { beforeAll, test } from "vitest"

import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { PdfImageInput } from "@/libs/utils/pdf/images-to-pdf"
import { initImageCodecs, makePng } from "../../support/image-codecs"

const run = (images: ReadonlyArray<PdfImageInput>, pageSize: ImagePdfPageSize) =>
  Effect.runPromise(
    Effect.provide(
      Effect.flatMap(PdfProcessor, (processor) => processor.imagesToPdf(images, pageSize)),
      PdfProcessor.layer,
    ),
  )

const options = (name: string) => ({
  time: 2_000,
  warmupTime: 0,
  iterations: 3,
  writeResult: `.amp/in/bench-pdf-${name}.json`,
})

const IMAGE_COUNT = 10

let pngs: ReadonlyArray<PdfImageInput>
let jpegs: ReadonlyArray<PdfImageInput>

beforeAll(async () => {
  await initImageCodecs()

  const png = await makePng(1200, 800)
  const decode = (await import("@jsquash/png/decode")).default
  const encode = (await import("@jsquash/jpeg/encode")).default
  const image = await decode(png.buffer)
  const jpeg = new Uint8Array(await encode(image!, { quality: 85 }))

  pngs = Array.from({ length: IMAGE_COUNT }, () => ({ data: png, format: "png" as const }))
  jpegs = Array.from({ length: IMAGE_COUNT }, () => ({ data: jpeg, format: "jpeg" as const }))
}, 60_000)

test("writes ten images into a PDF", { timeout: 240_000 }, async ({ bench }) => {
  await bench.compare(
    bench("10 png · fit", options("png-fit"), () => run(pngs, "fit")),
    bench("10 png · a4", options("png-a4"), () => run(pngs, "a4")),
    bench("10 jpeg · fit", options("jpeg-fit"), () => run(jpegs, "fit")),
  )
})
