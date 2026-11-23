import { Effect } from "effect"
import { zipSync } from "fflate"

import { PdfProcessingError } from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import {
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  MAX_SPLIT_OUTPUTS,
  type PdfPageRange,
  type PdfSplitMode,
} from "@/libs/schemas/pdf"
import type { PdfMergePage } from "@/libs/utils/pdf/qpdf"
import { disposePdfFile, getPdfDocument } from "./thumbnails"
import type { PdfFileEntry, PdfPageEntry } from "./store"

export type PreparePdfResult =
  | { readonly ok: true; readonly pageCount: number }
  | {
      readonly ok: false
      readonly reason: "password" | "invalid" | "too-large" | "too-many-pages"
      readonly message: string
    }

export const preparePdfFile = async (
  fileId: string,
  file: File,
  password?: string,
): Promise<PreparePdfResult> => {
  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB each.`,
    }
  }

  try {
    const document = await getPdfDocument(fileId, file, password)

    if (document.pageCount > MAX_PDF_PAGES) {
      disposePdfFile(fileId)

      return {
        ok: false,
        reason: "too-many-pages",
        message: `PDFs can have at most ${MAX_PDF_PAGES.toLocaleString()} pages.`,
      }
    }

    return { ok: true, pageCount: document.pageCount }
  } catch (cause) {
    const name = typeof cause === "object" && cause !== null && "name" in cause ? cause.name : null

    if (name === "PasswordException") {
      return {
        ok: false,
        reason: "password",
        message: password
          ? "That password did not open the PDF."
          : "This PDF is password-protected. Enter its password to continue.",
      }
    }

    return {
      ok: false,
      reason: "invalid",
      message: "This file is not a readable PDF.",
    }
  }
}

export interface MergePdfInput {
  readonly files: ReadonlyArray<PdfFileEntry>
  readonly pages: ReadonlyArray<PdfPageEntry>
}

export interface MergePdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly pages: number
}

export const mergePdfPages = (input: MergePdfInput): Promise<MergePdfOutput> =>
  runEffect(
    Effect.gen(function* () {
      const processor = yield* PdfProcessor
      const filesById = new Map(input.files.map((file) => [file.id, file]))
      const pages: Array<PdfMergePage> = []

      for (const page of input.pages) {
        const file = filesById.get(page.fileId)

        if (!file) {
          return yield* new PdfProcessingError({ message: "A selected PDF is missing." })
        }

        pages.push({
          fileId: page.fileId,
          file: file.file,
          pageNumber: page.pageNumber,
          password: file.password,
        })
      }

      const data = yield* processor.mergePages(pages)

      return {
        blob: new Blob([data], { type: "application/pdf" }),
        fileName: "merged.pdf",
        bytes: data.byteLength,
        inputBytes: input.files.reduce((total, file) => total + file.size, 0),
        pages: input.pages.length,
      }
    }),
  )

export interface SplitPdfInput {
  readonly file: PdfFileEntry
  readonly mode: PdfSplitMode
  readonly pagesPerFile: number
  readonly ranges: ReadonlyArray<PdfPageRange>
}

export interface SplitPdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly pages: number
  readonly outputs: number
}

const fileBaseName = (name: string) => name.replace(/\.pdf$/i, "") || "pdf"

export const splitPdf = (input: SplitPdfInput): Promise<SplitPdfOutput> =>
  runEffect(
    Effect.gen(function* () {
      const processor = yield* PdfProcessor
      const request =
        input.mode === "ranges"
          ? {
              mode: "ranges" as const,
              file: input.file.file,
              ranges: input.ranges,
              password: input.file.password,
            }
          : {
              mode: "chunks" as const,
              file: input.file.file,
              pagesPerFile: input.mode === "every" ? 1 : input.pagesPerFile,
              password: input.file.password,
            }
      const outputs = yield* processor.split(request)

      if (outputs.length === 0) {
        return yield* new PdfProcessingError({ message: "This split produced no files." })
      }

      if (outputs.length > MAX_SPLIT_OUTPUTS) {
        return yield* new PdfProcessingError({
          message: `A split can create at most ${MAX_SPLIT_OUTPUTS} files.`,
        })
      }

      if (outputs.length === 1) {
        const only = outputs[0]

        if (!only) {
          return yield* new PdfProcessingError({ message: "This split produced no files." })
        }

        return {
          blob: new Blob([only.data], { type: "application/pdf" }),
          fileName: only.name,
          bytes: only.data.byteLength,
          inputBytes: input.file.size,
          pages: input.file.pageCount,
          outputs: 1,
        }
      }

      const entries: Record<string, Uint8Array> = {}

      for (const output of outputs) {
        entries[output.name] = output.data
      }

      const zip = zipSync(entries, { level: 0 })

      return {
        blob: new Blob([zip], { type: "application/zip" }),
        fileName: `${fileBaseName(input.file.name)}-split.zip`,
        bytes: zip.byteLength,
        inputBytes: input.file.size,
        pages: input.file.pageCount,
        outputs: outputs.length,
      }
    }),
  )
