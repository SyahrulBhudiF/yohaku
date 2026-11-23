import { Context, Layer, type Effect } from "effect"

import {
  PdfCompressionError,
  PdfPasswordError,
  PdfProcessingError,
} from "@/infrastructure/errors/pdf"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { PdfCompressionResult } from "@/libs/utils/pdf/qpdf"
import { imagesToPdf, type PdfImageInput } from "@/libs/utils/pdf/images-to-pdf"
import { signPdf, type SignaturePlacement } from "@/libs/utils/pdf/sign"
import {
  compressPdf,
  mergePages,
  splitPdf,
  extractPages,
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
    readonly compress: (
      file: File,
      password?: string,
    ) => Effect.Effect<PdfCompressionResult, PdfPasswordError | PdfCompressionError>
    readonly split: (
      request: PdfSplitRequest,
    ) => Effect.Effect<ReadonlyArray<PdfOutput>, PdfPasswordError | PdfProcessingError>
    readonly extractPages: (
      file: File,
      pages: ReadonlyArray<number>,
      password?: string,
    ) => Effect.Effect<Uint8Array<ArrayBuffer>, PdfPasswordError | PdfProcessingError>
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
    PdfProcessor.of({
      mergePages,
      compress: compressPdf,
      split: splitPdf,
      extractPages,
      imagesToPdf,
      sign: signPdf,
    }),
  )
}
