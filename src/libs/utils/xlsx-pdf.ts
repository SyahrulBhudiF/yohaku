import { Effect } from "effect"

import { ExcelProcessingError } from "@/infrastructure/errors/excel"
import init, { convert_xlsx_to_pdf } from "@/libs/wasm/xlsx-pdf-core/xlsx_pdf_core.js"
import type { ExcelOrientation, ExcelPageSize } from "@/libs/schemas/excel"
import { convertXlsxInWorker, getXlsxPdfWorker } from "./xlsx-pdf-worker-client"

let ready: Promise<void> | null = null

const preloadDirect = (): Promise<void> => {
  ready ??= init()
    .then(() => undefined)
    .catch((cause: unknown) => {
      ready = null
      throw cause
    })

  return ready
}

export const preloadXlsxPdf = (): Promise<void> => {
  if (typeof Worker === "undefined") {
    return preloadDirect()
  }

  try {
    getXlsxPdfWorker().postMessage({ type: "warm" })

    return Promise.resolve()
  } catch {
    return preloadDirect()
  }
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
    const output = yield* Effect.tryPromise({
      try: async () => {
        if (typeof Worker === "undefined") {
          return convert_xlsx_to_pdf(bytes, pageSize, orientation)
        }

        return new Uint8Array(await convertXlsxInWorker(bytes, pageSize, orientation))
      },
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

    return output as Uint8Array<ArrayBuffer>
  })
