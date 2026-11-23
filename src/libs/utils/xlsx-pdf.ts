import { Effect } from "effect"

import { ExcelProcessingError } from "@/infrastructure/errors/excel"
import init, { convert_xlsx_to_pdf } from "@/libs/wasm/xlsx-pdf-core/xlsx_pdf_core.js"
import type { ExcelOrientation, ExcelPageSize } from "@/libs/schemas/excel"

let ready: Promise<void> | null = null

export const preloadXlsxPdf = (): Promise<void> => {
  ready ??= init()
    .then(() => undefined)
    .catch((cause: unknown) => {
      ready = null
      throw cause
    })

  return ready
}

const ensureLoaded = () =>
  Effect.tryPromise({
    try: preloadXlsxPdf,
    catch: () => new ExcelProcessingError({ message: "Could not load the Excel converter." }),
  })

export const convertXlsxToPdf = (
  bytes: Uint8Array,
  pageSize: ExcelPageSize,
  orientation: ExcelOrientation,
): Effect.Effect<Uint8Array<ArrayBuffer>, ExcelProcessingError> =>
  Effect.gen(function* () {
    yield* ensureLoaded()
    const output = yield* Effect.try({
      try: () => convert_xlsx_to_pdf(bytes, pageSize, orientation),
      catch: (cause) =>
        new ExcelProcessingError({
          message:
            typeof cause === "string"
              ? cause
              : cause instanceof Error
                ? cause.message
                : "Could not convert this workbook.",
        }),
    })

    // Copy once so the result is backed by a plain ArrayBuffer, which Blob
    // accepts without a type assertion.
    return new Uint8Array(output)
  })
