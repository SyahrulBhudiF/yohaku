import { Schema } from "effect"

export const MAX_CSV_EXCEL_BYTES = 20 * 1024 * 1024

export const CsvExcelModeSchema = Schema.Literals(["csv-to-excel", "excel-to-csv"])
export type CsvExcelMode = typeof CsvExcelModeSchema.Type
export const CSV_EXCEL_MODES = CsvExcelModeSchema.literals

export const CsvExcelFormSchema = Schema.Struct({
  mode: CsvExcelModeSchema,
  sheet: Schema.String.check(Schema.isMaxLength(100)),
})

export type CsvExcelFormValues = typeof CsvExcelFormSchema.Type

export const CsvExcelSheetsSchema = Schema.Array(Schema.String)
export type CsvExcelSheets = typeof CsvExcelSheetsSchema.Type

export const CsvExcelOutputSchema = Schema.Struct({
  blob: Schema.instanceOf(Blob),
  fileName: Schema.String,
  inputBytes: Schema.Int,
  outputBytes: Schema.Int,
  sheets: CsvExcelSheetsSchema,
  sheet: Schema.optional(Schema.String),
})

export type CsvExcelOutput = typeof CsvExcelOutputSchema.Type
