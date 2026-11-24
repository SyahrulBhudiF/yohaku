import { Effect } from "effect"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import type { PdfFileEntry, PdfPageEntry } from "@/features/pdf-tools/store"

export interface ReorganizePdfInput {
  readonly file: PdfFileEntry
  readonly pages: ReadonlyArray<PdfPageEntry>
}

export interface ReorganizePdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly pages: number
}

export const reorganizePdfFile = (input: ReorganizePdfInput): Promise<ReorganizePdfOutput> =>
  runEffect(
    Effect.gen(function* () {
      if (input.pages.length === 0) {
        return yield* new PdfProcessingError({ message: "Keep at least one PDF page." })
      }

      const processor = yield* PdfProcessor
      const data = yield* processor.reorganizePages(
        input.file.file,
        input.pages.map((page) => ({
          pageNumber: page.pageNumber,
          rotation: page.rotation ?? 0,
        })),
        input.file.password,
      )
      const baseName = input.file.name.replace(/\.pdf$/i, "") || "document"
      const blob = new Blob([data], { type: "application/pdf" })

      return {
        blob,
        fileName: `${baseName}-reorganized.pdf`,
        bytes: blob.size,
        inputBytes: input.file.size,
        pages: input.pages.length,
      }
    }),
  )
