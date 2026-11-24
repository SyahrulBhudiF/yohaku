import { Effect } from "effect"
import { beforeAll, test } from "vitest"

import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { PdfImageInput } from "@/libs/utils/pdf/images-to-pdf"
import { initImageCodecs, makePng } from "../../support/image-codecs"
import { fixtureFile } from "../../support/pdf"
import { initImagePdf } from "../../support/image-pdf"

const run = (images: ReadonlyArray<PdfImageInput>, pageSize: ImagePdfPageSize) =>
  Effect.runPromise(
    Effect.provide(
      Effect.flatMap(PdfProcessor, (processor) => processor.imagesToPdf(images, pageSize)),
      PdfProcessor.layer,
    ),
  )

const options = (name: string) => ({
  time: 1_000,
  warmupTime: 0,
  iterations: 3,
  writeResult: `.amp/in/bench-pdf-${name}.json`,
})

const compressionOptions = {
  time: 500,
  warmupTime: 100,
  iterations: 3,
  writeResult: ".amp/in/bench-pdf-compress-a.json",
}

const qpdfFeatureOptions = (name: string) => ({
  time: 1_000,
  warmupTime: 100,
  iterations: 3,
  writeResult: `.amp/in/bench-pdf-${name}.json`,
})

const IMAGE_COUNT = 10
const PDF_PAGE_COUNT = 50
const PDF_PASSWORD = "benchmark-password"

let pngs: ReadonlyArray<PdfImageInput>
let jpegs: ReadonlyArray<PdfImageInput>
let multiPagePdf: File
let protectedPdf: File

beforeAll(async () => {
  await initImageCodecs()
  initImagePdf()

  const png = await makePng(1200, 800)
  const decode = (await import("@jsquash/png/decode")).default
  const encode = (await import("@jsquash/jpeg/encode")).default
  const image = await decode(png.buffer)
  const jpeg = new Uint8Array(await encode(image!, { quality: 85 }))

  pngs = Array.from({ length: IMAGE_COUNT }, () => ({ data: png, format: "png" as const }))
  jpegs = Array.from({ length: IMAGE_COUNT }, () => ({ data: jpeg, format: "jpeg" as const }))

  const { PDFDocument, StandardFonts } = await import("pdf-lib")
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)

  for (let pageNumber = 1; pageNumber <= PDF_PAGE_COUNT; pageNumber++) {
    const page = document.addPage()

    page.drawText(`Benchmark page ${pageNumber}`, { x: 48, y: 740, font, size: 12 })
  }

  const documentBytes = await document.save()
  const pdfBytes = new Uint8Array(documentBytes.byteLength)

  pdfBytes.set(documentBytes)
  multiPagePdf = new File([pdfBytes.buffer], "benchmark.pdf", { type: "application/pdf" })

  const bytes = await Effect.runPromise(
    Effect.provide(
      Effect.flatMap(PdfProcessor, (processor) => processor.protect(multiPagePdf, PDF_PASSWORD)),
      PdfProcessor.layer,
    ),
  )

  if (!(bytes instanceof Blob)) {
    throw new TypeError("The Node benchmark expected a Blob PDF output.")
  }

  protectedPdf = new File([bytes], "benchmark-protected.pdf", {
    type: "application/pdf",
  })
}, 60_000)

test("compresses a representative PDF", { timeout: 240_000 }, async ({ bench }) => {
  const file = await fixtureFile("a.pdf")

  await bench("qpdf lossless compression", compressionOptions, () =>
    Effect.runPromise(
      Effect.provide(
        Effect.flatMap(PdfProcessor, (processor) => processor.compress(file)),
        PdfProcessor.layer,
      ),
    ),
  ).run()
})

test("writes ten images into a PDF", { timeout: 240_000 }, async ({ bench }) => {
  await bench.compare(
    bench("10 png · fit", options("png-fit"), () => run(pngs, "fit")),
    bench("10 png · a4", options("png-a4"), () => run(pngs, "a4")),
    bench("10 jpeg · fit", options("jpeg-fit"), () => run(jpegs, "fit")),
  )
})

test("reorganizes and rotates fifty PDF pages", { timeout: 240_000 }, async ({ bench }) => {
  const pages = Array.from({ length: PDF_PAGE_COUNT }, (_, index) => ({
    pageNumber: PDF_PAGE_COUNT - index,
    rotation: (index === 0 ? 90 : 0) as 0 | 90,
  }))

  await bench("qpdf reorder 50 pages + rotate one", qpdfFeatureOptions("reorganize-50-pages"), () =>
    Effect.runPromise(
      Effect.provide(
        Effect.flatMap(PdfProcessor, (processor) => processor.reorganizePages(multiPagePdf, pages)),
        PdfProcessor.layer,
      ),
    ),
  ).run()
})

test("protects and unlocks a fifty-page PDF", { timeout: 240_000 }, async ({ bench }) => {
  await bench("qpdf AES-256 protect 50 pages", qpdfFeatureOptions("protect-50-pages"), () =>
    Effect.runPromise(
      Effect.provide(
        Effect.flatMap(PdfProcessor, (processor) => processor.protect(multiPagePdf, PDF_PASSWORD)),
        PdfProcessor.layer,
      ),
    ),
  ).run()

  await bench("qpdf AES-256 unlock 50 pages", qpdfFeatureOptions("unlock-50-pages"), () =>
    Effect.runPromise(
      Effect.provide(
        Effect.flatMap(PdfProcessor, (processor) => processor.unlock(protectedPdf, PDF_PASSWORD)),
        PdfProcessor.layer,
      ),
    ),
  ).run()
})
