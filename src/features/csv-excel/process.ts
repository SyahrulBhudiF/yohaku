import { Effect, Schema } from "effect"

import { CsvExcelError } from "@/infrastructure/errors/csv-excel"
import { runEffect } from "@/infrastructure/runtime"
import {
  CsvExcelOutputSchema,
  CsvExcelSheetsSchema,
  MAX_CSV_EXCEL_BYTES,
  type CsvExcelMode,
  type CsvExcelOutput,
  type CsvExcelSheets,
} from "@/libs/schemas/csv-excel"

export interface ConvertCsvExcelInput {
  readonly file: File
  readonly mode: CsvExcelMode
  readonly sheet?: string
}

const isCsvFile = (file: File) =>
  file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv"

const isSpreadsheetFile = (file: File) =>
  /\.(xlsx|xls)$/i.test(file.name) ||
  file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
  file.type === "application/vnd.ms-excel"

const readWorkbook = async (file: File) => {
  const xlsx = await import("xlsx")
  const workbook = xlsx.read(new Uint8Array(await file.arrayBuffer()), { type: "array" })

  return { xlsx, workbook }
}

const validateFile = (file: File, mode: CsvExcelMode) =>
  Effect.gen(function* () {
    if (file.size === 0 || file.size > MAX_CSV_EXCEL_BYTES) {
      return yield* new CsvExcelError({
        message:
          file.size === 0
            ? "This file is empty."
            : `Files can be at most ${MAX_CSV_EXCEL_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (mode === "csv-to-excel" && !isCsvFile(file)) {
      return yield* new CsvExcelError({ message: "Choose a CSV file." })
    }

    if (mode === "excel-to-csv" && !isSpreadsheetFile(file)) {
      return yield* new CsvExcelError({ message: "Choose an XLSX or XLS workbook." })
    }
  })

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "spreadsheet"
const safeSheetName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "-").trim() || "sheet"

const readSheetsProgram = (file: File) =>
  Effect.gen(function* () {
    if (file.size === 0 || file.size > MAX_CSV_EXCEL_BYTES) {
      return yield* new CsvExcelError({
        message:
          file.size === 0
            ? "This file is empty."
            : `Files can be at most ${MAX_CSV_EXCEL_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (!isSpreadsheetFile(file)) {
      return yield* new CsvExcelError({ message: "Choose an XLSX or XLS workbook." })
    }

    const sheets = yield* Effect.tryPromise({
      try: async () => (await readWorkbook(file)).workbook.SheetNames,
      catch: () => new CsvExcelError({ message: "Could not read this workbook." }),
    })

    return yield* Schema.decodeEffect(CsvExcelSheetsSchema)(sheets).pipe(
      Effect.mapError(() => new CsvExcelError({ message: "Could not read the sheet names." })),
    )
  })

export const readCsvExcelSheets = (file: File): Promise<CsvExcelSheets> =>
  runEffect(readSheetsProgram(file))

export const convertCsvExcel = (input: ConvertCsvExcelInput): Promise<CsvExcelOutput> =>
  runEffect(
    Effect.gen(function* () {
      yield* validateFile(input.file, input.mode)

      const output = yield* Effect.tryPromise({
        try: async () => {
          const { xlsx, workbook } = await readWorkbook(input.file)
          const base = fileBaseName(input.file.name)
          const sheets = workbook.SheetNames

          if (input.mode === "csv-to-excel") {
            const bytes = xlsx.write(workbook, { bookType: "xlsx", type: "array" })
            const blob = new Blob([bytes], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })

            return {
              blob,
              fileName: `${base}.xlsx`,
              inputBytes: input.file.size,
              outputBytes: blob.size,
              sheets,
            }
          }

          const sheetName = input.sheet && sheets.includes(input.sheet) ? input.sheet : sheets[0]

          if (!sheetName) {
            throw new CsvExcelError({ message: "This workbook has no worksheets." })
          }

          const worksheet = workbook.Sheets[sheetName]

          if (!worksheet) {
            throw new CsvExcelError({ message: "This worksheet could not be read." })
          }

          const csv = xlsx.utils.sheet_to_csv(worksheet, { blankrows: false })
          const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })

          return {
            blob,
            fileName: `${base}-${safeSheetName(sheetName)}.csv`,
            inputBytes: input.file.size,
            outputBytes: blob.size,
            sheets,
            sheet: sheetName,
          }
        },
        catch: (cause) =>
          cause instanceof CsvExcelError
            ? cause
            : new CsvExcelError({
                message:
                  input.mode === "csv-to-excel"
                    ? "Could not convert this CSV into an Excel workbook."
                    : "Could not export this worksheet as CSV.",
              }),
      })

      return yield* Schema.decodeEffect(CsvExcelOutputSchema)(output).pipe(
        Effect.mapError(() => new CsvExcelError({ message: "Could not prepare the result." })),
      )
    }),
  )
