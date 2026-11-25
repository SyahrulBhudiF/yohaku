import { Effect } from "effect"

import { PdfAnnotateError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_IMAGE_BYTES } from "@/libs/schemas/image"
import { MAX_PDF_BYTES, MAX_PDF_PAGES, type PdfAnnotateFormValues } from "@/libs/schemas/pdf"
import { detectImageFormat } from "@/libs/utils/image-codec"
import { parsePageSelection } from "@/libs/utils/pdf/ranges"
import { annotatePdf } from "./annotate"
import { annotatePdfInWorker } from "./worker-client"
import type { PdfAnnotateOptions } from "./types"

export interface PdfAnnotateInput {
  readonly file: File
  readonly pageCount: number
  readonly values: PdfAnnotateFormValues
  readonly logo: File | null
}

export interface PdfAnnotateOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly pages: number
}

const baseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "document"

const readLogo = async (file: File) => {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new PdfAnnotateError({
      message: `Watermark images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const format = detectImageFormat(bytes.subarray(0, 16))

  if (format !== "png" && format !== "jpeg") {
    throw new PdfAnnotateError({ message: "Use a PNG or JPEG watermark image." })
  }

  return { bytes, kind: format }
}

const program = (input: PdfAnnotateInput) =>
  Effect.gen(function* () {
    if (input.file.size === 0 || input.file.size > MAX_PDF_BYTES) {
      return yield* new PdfAnnotateError({
        message:
          input.file.size === 0
            ? "This PDF is empty."
            : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (input.pageCount > MAX_PDF_PAGES) {
      return yield* new PdfAnnotateError({
        message: `PDFs can have at most ${MAX_PDF_PAGES.toLocaleString()} pages.`,
      })
    }

    const selection = parsePageSelection(input.values.pageSelection, input.pageCount)

    if (!selection.ok) {
      return yield* new PdfAnnotateError({ message: selection.message })
    }

    const pages =
      input.values.mode === "numbers" && input.values.skipFirstPage
        ? selection.pages.filter((page) => page !== 1)
        : selection.pages

    if (pages.length === 0) {
      return yield* new PdfAnnotateError({
        message: "No pages are left after skipping the first page.",
      })
    }

    if (
      input.values.mode === "watermark" &&
      input.values.watermarkKind === "text" &&
      input.values.watermarkText.trim() === ""
    ) {
      return yield* new PdfAnnotateError({ message: "Enter watermark text." })
    }

    if (
      input.values.mode === "watermark" &&
      input.values.watermarkKind === "image" &&
      !input.logo
    ) {
      return yield* new PdfAnnotateError({ message: "Choose a PNG or JPEG watermark image." })
    }

    const logo =
      input.values.mode === "watermark" && input.values.watermarkKind === "image" && input.logo
        ? yield* Effect.tryPromise({
            try: () => readLogo(input.logo!),
            catch: (cause) =>
              cause instanceof PdfAnnotateError
                ? cause
                : new PdfAnnotateError({ message: "Could not read the watermark image." }),
          })
        : null
    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => input.file.arrayBuffer(),
        catch: () => new PdfAnnotateError({ message: "Could not read this PDF." }),
      }),
    )
    const options: PdfAnnotateOptions = {
      mode: input.values.mode,
      pages,
      number: {
        start: input.values.numberStart,
        format: input.values.numberFormat,
        position: input.values.numberPosition,
        fontSize: input.values.numberFontSize,
        margin: input.values.numberMargin,
      },
      watermark: {
        kind: input.values.watermarkKind,
        text: input.values.watermarkText,
        placement: input.values.watermarkPlacement,
        opacity: input.values.watermarkOpacity,
        rotation: input.values.watermarkRotation,
        fontSize: input.values.watermarkFontSize,
        scale: input.values.watermarkScale,
      },
    }
    const output = yield* Effect.tryPromise({
      try: async () => {
        if (typeof Worker === "undefined") {
          return annotatePdf(
            bytes.buffer,
            options,
            logo ? { bytes: logo.bytes.slice().buffer, kind: logo.kind } : undefined,
          )
        }

        return new Uint8Array(
          await annotatePdfInWorker(
            bytes,
            options,
            logo ? { bytes: logo.bytes, kind: logo.kind } : undefined,
          ),
        )
      },
      catch: (cause) =>
        new PdfAnnotateError({
          message:
            cause instanceof Error ? cause.message : "Could not add annotations to this PDF.",
        }),
    })
    const suffix = input.values.mode === "numbers" ? "-numbered" : "-watermarked"

    return {
      blob: new Blob([output], { type: "application/pdf" }),
      fileName: `${baseName(input.file.name)}${suffix}.pdf`,
      inputBytes: input.file.size,
      outputBytes: output.byteLength,
      pages: pages.length,
    }
  })

export const processPdfAnnotate = (input: PdfAnnotateInput): Promise<PdfAnnotateOutput> =>
  runEffect(program(input))
