import { Context, Layer, type Effect } from "effect"

import { PdfPasswordError, PdfProcessingError } from "@/infrastructure/errors/pdf"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import { imagesToPdf, type PdfImageInput } from "@/libs/utils/pdf/images-to-pdf"
import { signPdf, type SignaturePlacement } from "@/libs/utils/pdf/sign"
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
    readonly imagesToPdf: (
      images: ReadonlyArray<PdfImageInput>,
      pageSize: ImagePdfPageSize,
    ) => Effect.Effect<Uint8Array<ArrayBuffer>, PdfProcessingError>
    readonly sign: (
      file: File,
      placements: ReadonlyArray<SignaturePlacement>,
    ) => Effect.Effect<Blob, PdfProcessingError>
  }
>()("tools/PdfProcessor") {
  static readonly layer = Layer.succeed(
    PdfProcessor,
    PdfProcessor.of({ mergePages, split: splitPdf, imagesToPdf, sign: signPdf }),
  )
}
