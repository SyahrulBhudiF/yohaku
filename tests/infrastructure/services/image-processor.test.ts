import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import sharp from "sharp"

import { ImageProcessor } from "@/infrastructure/services/image-processor"

const makePng = (width: number, height: number) =>
  Effect.promise(async () => {
    const noise = Uint8Array.from(
      { length: width * height * 3 },
      (_, index) => (index * 7919) % 251,
    )
    const png = await sharp(noise, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()

    return new Uint8Array(png)
  })

const run = <A, E>(effect: Effect.Effect<A, E, ImageProcessor>) =>
  Effect.provide(effect, ImageProcessor.layer)

describe("ImageProcessor", () => {
  it.effect("converts a png to webp and detects the result", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const input = yield* makePng(32, 32)
        const output = yield* processor.transcode(input, "webp", 80)

        assert.strictEqual(output.format, "webp")
        assert.strictEqual(yield* processor.detectFormat(output.data), "webp")
      }),
    ),
  )

  it.effect("compresses a jpeg smaller at lower quality", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const input = yield* makePng(128, 128)
        const high = yield* processor.transcode(input, "jpeg", 95)
        const low = yield* processor.transcode(input, "jpeg", 20)

        assert.isTrue(low.data.byteLength < high.data.byteLength)
      }),
    ),
  )

  it.effect("fails with ImageProcessingError for non-image bytes", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const error = yield* Effect.flip(
          processor.detectFormat(new TextEncoder().encode("not an image")),
        )

        assert.strictEqual(error._tag, "ImageProcessingError")
      }),
    ),
  )
})
