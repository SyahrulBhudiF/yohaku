import { Context, Layer, type Effect } from "effect"

import {
  PdfCompressionError,
  PdfDecryptionError,
  PdfEncryptionError,
  PdfPasswordError,
  PdfProcessingError,
  PdfReorganizationError,
} from "@/infrastructure/errors/pdf"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { PdfCompressionResult } from "@/libs/utils/pdf/qpdf"
import type { PdfDocumentOutput } from "@/libs/utils/pdf/qpdf"
import { imagesToPdf, type PdfImageInput } from "@/libs/utils/pdf/images-to-pdf"
import { signPdf, type SignaturePlacement } from "@/libs/utils/pdf/sign"
import {
  compressPdf,
  mergePages,
  splitPdf,
  extractPages,
  reorganizePages,
  protectPdf,
  unlockPdf,
  type PdfMergePage,
  type PdfOutput,
  type PdfReorganizationPage,
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
    readonly reorganizePages: (
      file: File,
      pages: ReadonlyArray<PdfReorganizationPage>,
      password?: string,
    ) => Effect.Effect<Uint8Array<ArrayBuffer>, PdfPasswordError | PdfReorganizationError>
    readonly protect: (
      file: File,
      password: string,
    ) => Effect.Effect<PdfDocumentOutput, PdfEncryptionError>
    readonly unlock: (
      file: File,
      password: string,
    ) => Effect.Effect<PdfDocumentOutput, PdfPasswordError | PdfDecryptionError>
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
      reorganizePages,
      protect: protectPdf,
      unlock: unlockPdf,
      imagesToPdf,
      sign: signPdf,
    }),
  )
}
