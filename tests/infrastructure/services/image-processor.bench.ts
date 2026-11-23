import { Effect } from "effect"
import { beforeAll, test } from "vitest"

import { ImageProcessor } from "@/infrastructure/services/image-processor"
import type { ImageFormat } from "@/libs/schemas/image"
import { initImageCodecs, makePng } from "../../support/image-codecs"

const run = (input: Uint8Array, format: ImageFormat, quality: number) =>
  Effect.runPromise(
    Effect.provide(
      Effect.flatMap(ImageProcessor, (processor) => processor.transcode(input, format, quality)),
      ImageProcessor.layer,
    ),
  )

const options = {
  time: 1_000,
  warmupTime: 0,
  iterations: 3,
  writeResult: ".amp/in/bench-image.json",
}

let source: Uint8Array

beforeAll(async () => {
  await initImageCodecs()
  source = await makePng(1200, 800)
  await run(source, "webp", 80)
}, 60_000)

test("encodes a 1200x800 png at quality 80", { timeout: 240_000 }, async ({ bench }) => {
  await bench.compare(
    bench("webp", options, () => run(source, "webp", 80)),
    bench("jpeg", options, () => run(source, "jpeg", 80)),
    bench("avif", options, () => run(source, "avif", 80)),
    bench("gif", options, () => run(source, "gif", 80)),
    bench("tiff", options, () => run(source, "tiff", 80)),
  )
})
