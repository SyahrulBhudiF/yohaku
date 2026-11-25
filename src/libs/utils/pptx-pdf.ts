import { Effect } from "effect"

import { PowerPointProcessingError } from "@/infrastructure/errors/powerpoint"
import init, { convert_pptx_to_pdf } from "@/libs/wasm/pptx-pdf-core/pptx_pdf_core.js"
import { convertPptxInWorker, getPptxPdfWorker } from "./pptx-pdf-worker-client"

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

export const preloadPptxPdf = (): Promise<void> => {
  if (typeof Worker === "undefined") {
    return preloadDirect()
  }

  try {
    getPptxPdfWorker().postMessage({ type: "warm" })

    return Promise.resolve()
  } catch {
    return preloadDirect()
  }
}

const ensureLoaded = () =>
  Effect.tryPromise({
    try: preloadPptxPdf,
    catch: () =>
      new PowerPointProcessingError({ message: "Could not load the PowerPoint converter." }),
  })

export const convertPptxToPdf = (
  bytes: Uint8Array,
): Effect.Effect<Uint8Array<ArrayBuffer>, PowerPointProcessingError> =>
  Effect.gen(function* () {
    yield* ensureLoaded()

    const output = yield* Effect.tryPromise({
      try: async () => {
        if (typeof Worker === "undefined") {
          return convert_pptx_to_pdf(bytes)
        }

        return new Uint8Array(await convertPptxInWorker(bytes))
      },
      catch: (cause) =>
        new PowerPointProcessingError({
          message:
            typeof cause === "string"
              ? cause
              : cause instanceof Error
                ? cause.message
                : "Could not convert this presentation.",
        }),
    })

    return output as Uint8Array<ArrayBuffer>
  })
