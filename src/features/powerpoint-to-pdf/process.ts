import { Effect } from "effect"

import { PowerPointProcessingError } from "@/infrastructure/errors/powerpoint"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_PPTX_BYTES } from "@/libs/schemas/powerpoint"
import { convertPptxToPdf } from "@/libs/utils/pptx-pdf"

export interface PowerPointToPdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
}

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "presentation"

const program = (file: File) =>
  Effect.gen(function* () {
    if (file.size === 0) {
      return yield* new PowerPointProcessingError({ message: "This presentation is empty." })
    }

    if (file.size > MAX_PPTX_BYTES) {
      return yield* new PowerPointProcessingError({
        message: `Presentations can be at most ${MAX_PPTX_BYTES / 1024 / 1024} MB.`,
      })
    }

    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: () =>
          new PowerPointProcessingError({ message: "Could not read this presentation." }),
      }),
    )
    const data = yield* convertPptxToPdf(bytes)
    const blob = new Blob([data], { type: "application/pdf" })

    return {
      blob,
      fileName: `${fileBaseName(file.name)}.pdf`,
      inputBytes: file.size,
      outputBytes: blob.size,
    }
  })

export const processPowerPointToPdf = (file: File): Promise<PowerPointToPdfOutput> =>
  runEffect(program(file))
