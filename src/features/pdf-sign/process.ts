import { Effect } from "effect"

import { runEffect } from "@/infrastructure/runtime"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import type { SignaturePlacement } from "@/libs/utils/pdf/sign"

export type { SignaturePlacement } from "@/libs/utils/pdf/sign"

/** Encrypted PDFs are not supported. */
export const signPdf = (file: File, placements: readonly SignaturePlacement[]): Promise<Blob> =>
  runEffect(
    Effect.gen(function* () {
      const processor = yield* PdfProcessor

      return yield* processor.sign(file, placements)
    }),
  )
