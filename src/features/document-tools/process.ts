import { Effect } from "effect"

import { ExcelProcessingError } from "@/infrastructure/errors/excel"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_EXCEL_BYTES, type ExcelOrientation, type ExcelPageSize } from "@/libs/schemas/excel"
import { convertXlsxToPdf } from "@/libs/utils/xlsx-pdf"

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
