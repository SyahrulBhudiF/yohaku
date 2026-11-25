import { Effect } from "effect"

import { ExcelProcessingError } from "@/infrastructure/errors/excel"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_EXCEL_BYTES, type ExcelOrientation, type ExcelPageSize } from "@/libs/schemas/excel"
import { convertXlsxToPdf } from "@/libs/utils/xlsx-pdf"
import { MarkdownFileReadError } from "@/infrastructure/errors/document-conversion"
import { MAX_MARKDOWN_FILE_BYTES } from "@/libs/schemas/document"

export interface ExcelToPdfInput {
  readonly file: File
  readonly pageSize: ExcelPageSize
  readonly orientation: ExcelOrientation
}

export interface ExcelToPdfOutput {
  readonly blob: Blob
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
}

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "workbook"

const program = (input: ExcelToPdfInput) =>
  Effect.gen(function* () {
    if (input.file.size > MAX_EXCEL_BYTES) {
      return yield* new ExcelProcessingError({
        message: `Workbooks can be at most ${MAX_EXCEL_BYTES / 1024 / 1024} MB.`,
      })
    }

    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => input.file.arrayBuffer(),
        catch: () => new ExcelProcessingError({ message: "Could not read this workbook." }),
      }),
    )
    const data = yield* convertXlsxToPdf(bytes, input.pageSize, input.orientation)

    return {
      blob: new Blob([data], { type: "application/pdf" }),
      fileName: `${fileBaseName(input.file.name)}.pdf`,
      bytes: data.byteLength,
      inputBytes: input.file.size,
    }
  })

export const processExcelToPdf = (input: ExcelToPdfInput): Promise<ExcelToPdfOutput> =>
  runEffect(program(input))

export const readMarkdownFile = (file: File) =>
  runEffect(
    Effect.gen(function* () {
      if (!/\.(md|markdown)$/i.test(file.name)) {
        return yield* new MarkdownFileReadError({ message: "Choose a .md or .markdown file." })
      }

      if (file.size > MAX_MARKDOWN_FILE_BYTES) {
        return yield* new MarkdownFileReadError({
          message: `Markdown files can be up to ${MAX_MARKDOWN_FILE_BYTES / 1024 / 1024} MB.`,
        })
      }

      return yield* Effect.tryPromise({
        try: () => file.text(),
        catch: () => new MarkdownFileReadError({ message: "Could not read this Markdown file." }),
      })
    }),
  )
