import { Context, Layer, type Effect } from "effect"

import { PdfPasswordError, PdfProcessingError } from "@/infrastructure/errors/pdf"
import {
  mergePages,
  splitPdf,
  type PdfMergePage,
  type PdfOutput,
  type PdfSplitRequest,
} from "@/libs/utils/pdf/qpdf"

export class PdfProcessor extends Context.Service<
  PdfProcessor,
  {
    readonly mergePages: (
      pages: ReadonlyArray<PdfMergePage>,
    ) => Effect.Effect<Uint8Array<ArrayBuffer>, PdfPasswordError | PdfProcessingError>
    readonly split: (
      request: PdfSplitRequest,
    ) => Effect.Effect<ReadonlyArray<PdfOutput>, PdfPasswordError | PdfProcessingError>
  }
>()("tools/PdfProcessor") {
  static readonly layer = Layer.succeed(
    PdfProcessor,
    PdfProcessor.of({ mergePages, split: splitPdf }),
  )
}
