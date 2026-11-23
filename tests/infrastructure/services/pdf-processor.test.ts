import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { beforeAll } from "vitest"

import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import { initImageCodecs, makePng } from "../../support/image-codecs"
import { initImagePdf } from "../../support/image-pdf"
import { extractPdfText, fixtureFile } from "../../support/pdf"

beforeAll(async () => {
  await initImageCodecs()
  initImagePdf()
}, 60_000)

const run = <A, E>(effect: Effect.Effect<A, E, PdfProcessor>) =>
  Effect.provide(effect, PdfProcessor.layer)

describe("PdfProcessor", () => {
  it.effect("merges pages in the chosen order", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const a = yield* Effect.promise(() => fixtureFile("a.pdf"))
        const b = yield* Effect.promise(() => fixtureFile("b.pdf"))
        const merged = yield* processor.mergePages([
          { fileId: "b", file: b, pageNumber: 1, password: undefined },
          { fileId: "a", file: a, pageNumber: 2, password: undefined },
          { fileId: "a", file: a, pageNumber: 1, password: undefined },
        ])

        assert.deepEqual(yield* Effect.promise(() => extractPdfText(merged)), [
          "b page 1",
          "a page 2",
          "a page 1",
        ])
      }),
    ),
  )

  it.effect("splits into chunks", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const a = yield* Effect.promise(() => fixtureFile("a.pdf"))
        const outputs = yield* processor.split({
          mode: "chunks",
          file: a,
          pagesPerFile: 2,
          password: undefined,
        })

        assert.lengthOf(outputs, 2)
        assert.deepEqual(yield* Effect.promise(() => extractPdfText(outputs[0]!.data)), [
          "a page 1",
          "a page 2",
        ])
        assert.deepEqual(yield* Effect.promise(() => extractPdfText(outputs[1]!.data)), [
          "a page 3",
        ])
      }),
    ),
  )

  it.effect("splits custom ranges and names the outputs", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const a = yield* Effect.promise(() => fixtureFile("a.pdf"))
        const outputs = yield* processor.split({
          mode: "ranges",
          file: a,
          ranges: [
            { start: 1, end: 2 },
            { start: 3, end: 3 },
          ],
          password: undefined,
        })

        assert.deepEqual(
          outputs.map((output) => output.name),
          ["pages-1-2.pdf", "pages-3.pdf"],
        )
        assert.deepEqual(yield* Effect.promise(() => extractPdfText(outputs[0]!.data)), [
          "a page 1",
          "a page 2",
        ])
      }),
    ),
  )

  it.effect("reads a password-protected PDF", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const encrypted = yield* Effect.promise(() => fixtureFile("enc.pdf"))
        const merged = yield* processor.mergePages([
          { fileId: "enc", file: encrypted, pageNumber: 1, password: "secret" },
        ])

        assert.deepEqual(yield* Effect.promise(() => extractPdfText(merged)), ["enc page 1"])
      }),
    ),
  )

  it.effect("fails with PdfPasswordError for a wrong password", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const encrypted = yield* Effect.promise(() => fixtureFile("enc.pdf"))
        const error = yield* Effect.flip(
          processor.mergePages([
            { fileId: "enc", file: encrypted, pageNumber: 1, password: "wrong" },
          ]),
        )

        assert.strictEqual(error._tag, "PdfPasswordError")
      }),
    ),
  )

  it.effect("fails with PdfPasswordError when splitting with a wrong password", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const encrypted = yield* Effect.promise(() => fixtureFile("enc.pdf"))
        const error = yield* Effect.flip(
          processor.split({
            mode: "chunks",
            file: encrypted,
            pagesPerFile: 1,
            password: "wrong",
          }),
        )

        assert.strictEqual(error._tag, "PdfPasswordError")
      }),
    ),
  )

  it.effect("creates one PDF page per image and fits the long side", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const png = yield* Effect.promise(() => makePng(120, 80))
        const output = yield* processor.imagesToPdf(
          [
            { data: png, format: "png" },
            { data: png, format: "png" },
          ],
          "fit",
        )
        const { PDFDocument } = yield* Effect.promise(() => import("pdf-lib"))
        const document = yield* Effect.promise(() => PDFDocument.load(output))
        const page = document.getPage(0)

        assert.strictEqual(document.getPageCount(), 2)
        assert.closeTo(page.getWidth(), 842, 0.5)
        assert.closeTo(page.getHeight(), 561.33, 0.5)
      }),
    ),
  )

  it.effect("places a landscape image on a landscape A4 page", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const png = yield* Effect.promise(() => makePng(120, 80))
        const output = yield* processor.imagesToPdf([{ data: png, format: "png" }], "a4")
        const { PDFDocument } = yield* Effect.promise(() => import("pdf-lib"))
        const document = yield* Effect.promise(() => PDFDocument.load(output))
        const page = document.getPage(0)

        assert.closeTo(page.getWidth(), 841.89, 0.5)
        assert.closeTo(page.getHeight(), 595.28, 0.5)
      }),
    ),
  )

  it.effect("rejects an empty image list", () =>
    run(
      Effect.gen(function* () {
        const processor = yield* PdfProcessor
        const error = yield* Effect.flip(processor.imagesToPdf([], "fit"))

        assert.strictEqual(error._tag, "PdfProcessingError")
      }),
    ),
  )
})
