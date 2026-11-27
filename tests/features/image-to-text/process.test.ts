import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { afterEach, vi } from "vitest"

import { convertImageToTextProgram } from "@/features/image-to-text/process"
import { PdfOcrError } from "@/infrastructure/errors/pdf"
import { PdfOcr } from "@/infrastructure/services/pdf-ocr"
import type { PdfOcrLine, PdfOcrQuality } from "@/libs/schemas/pdf"

const lines: ReadonlyArray<PdfOcrLine> = [
  { text: "Hello", x: 0, y: 0, width: 20, height: 10, score: 1 },
  { text: "world", x: 25, y: 0, width: 20, height: 10, score: 1 },
  { text: "second", x: 0, y: 20, width: 20, height: 10, score: 1 },
]

const fileBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("image OCR process", () => {
  it.effect("extracts grouped text, reports progress, and releases the bitmap", () => {
    const close = vi.fn<() => void>()
    const prepare = vi.fn<(quality: PdfOcrQuality) => Effect.Effect<void, PdfOcrError>>(
      () => Effect.void,
    )
    const recognizePages = vi.fn<
      (
        images: ReadonlyArray<ImageBitmap>,
        quality: PdfOcrQuality,
      ) => Effect.Effect<ReadonlyArray<ReadonlyArray<PdfOcrLine>>, PdfOcrError>
    >(() => Effect.succeed([lines]))
    const layer = Layer.succeed(
      PdfOcr,
      PdfOcr.of({
        prepare,
        recognizePages,
      }),
    )
    const phases: Array<string> = []
    const file = new File([fileBytes], "screenshot.png", { type: "image/png" })
    const createImageBitmapMock = vi.fn<
      () => Promise<{ width: number; height: number; close: () => void }>
    >(async () => ({ width: 120, height: 80, close }))

    vi.stubGlobal("createImageBitmap", createImageBitmapMock)

    return Effect.gen(function* () {
      const output = yield* convertImageToTextProgram({
        file,
        preferAccuracy: false,
        onProgress: (progress) => phases.push(progress.phase),
      })

      assert.strictEqual(output.text, "Hello world\nsecond")
      assert.strictEqual(output.fileName, "screenshot.txt")
      assert.strictEqual(output.inputBytes, file.size)
      assert.deepStrictEqual(phases, ["loading-model", "recognizing"])
      assert.strictEqual(prepare.mock.calls[0]?.[0], "speed")
      assert.strictEqual(recognizePages.mock.calls[0]?.[1], "speed")
      assert.strictEqual(close.mock.calls.length, 1)
    }).pipe(Effect.provide(layer))
  })
})
