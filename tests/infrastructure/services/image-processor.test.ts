import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { beforeAll } from "vitest"

import { ImageProcessor } from "@/infrastructure/services/image-processor"
import { initImageCodecs, makePng } from "../../support/image-codecs"

beforeAll(initImageCodecs, 60_000)

const run = <A, E>(effect: Effect.Effect<A, E, ImageProcessor>) =>
  Effect.provide(effect, ImageProcessor.layer)

const makeOrientedJpeg = async (width: number, height: number, orientation: number) => {
  const encode = (await import("@jsquash/jpeg/encode")).default
  const data = new Uint8ClampedArray(width * height * 4).fill(180)
  const jpeg = new Uint8Array(await encode(new ImageData(data, width, height), { quality: 90 }))
  const payload = [
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // Exif\0\0
    0x49,
    0x49,
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00, // TIFF header, little endian
    0x01,
    0x00, // one entry
    0x12,
    0x01,
    0x03,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00, // tag 0x0112
    0x00,
    0x00,
    0x00,
    0x00, // no next IFD
  ]
  const length = payload.length + 2
  const app1 = [0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload]

  return new Uint8Array([0xff, 0xd8, ...app1, ...jpeg.subarray(2)])
}

describe("ImageProcessor", () => {
  it.effect("converts a png to webp and detects the result", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const input = yield* Effect.promise(() => makePng())
        const output = yield* processor.transcode(input, "webp", 80)

        assert.strictEqual(output.format, "webp")
        assert.strictEqual(yield* processor.detectFormat(output.data), "webp")
      }),
    ),
  )

  it.effect("encodes avif", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const input = yield* Effect.promise(() => makePng())
        const output = yield* processor.transcode(input, "avif", 60)

        assert.strictEqual(yield* processor.detectFormat(output.data), "avif")
      }),
    ),
  )

  it.effect("compresses a jpeg smaller at lower quality", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const input = yield* Effect.promise(() => makePng(128, 128))
        const high = yield* processor.transcode(input, "jpeg", 95)
        const low = yield* processor.transcode(input, "jpeg", 20)

        assert.isTrue(low.data.byteLength < high.data.byteLength)
      }),
    ),
  )

  it.effect("detects avif whose major brand is mif1", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const bytes = new Uint8Array(24)

        new DataView(bytes.buffer).setUint32(0, 24)
        bytes.set(new TextEncoder().encode("ftyp"), 4)
        bytes.set(new TextEncoder().encode("mif1"), 8)
        bytes.set(new TextEncoder().encode("avif"), 16)

        assert.strictEqual(yield* processor.detectFormat(bytes), "avif")
      }),
    ),
  )

  it.effect("applies the jpeg exif orientation before encoding", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const jpeg = yield* Effect.promise(() => makeOrientedJpeg(40, 20, 6))
        const png = yield* processor.transcode(jpeg, "png", 90)
        const image = yield* Effect.promise(async () =>
          (await import("@jsquash/png/decode")).default(png.data.buffer),
        )

        assert.strictEqual(image.width, 20)
        assert.strictEqual(image.height, 40)
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

  it.effect("round-trips gif", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const input = yield* Effect.promise(() => makePng(64, 48))
        const gif = yield* processor.transcode(input, "gif", 80)

        assert.strictEqual(yield* processor.detectFormat(gif.data), "gif")

        const png = yield* processor.transcode(gif.data, "png", 90)

        assert.strictEqual(yield* processor.detectFormat(png.data), "png")
      }),
    ),
  )

  it.effect("round-trips tiff", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* ImageProcessor
        const input = yield* Effect.promise(() => makePng(64, 48))
        const tiff = yield* processor.transcode(input, "tiff", 80)

        assert.strictEqual(yield* processor.detectFormat(tiff.data), "tiff")

        const png = yield* processor.transcode(tiff.data, "png", 90)

        assert.strictEqual(yield* processor.detectFormat(png.data), "png")
      }),
    ),
  )
})
