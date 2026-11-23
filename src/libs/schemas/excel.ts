import { Schema } from "effect"

export const MAX_EXCEL_BYTES = 25 * 1024 * 1024

export const ExcelPageSizeSchema = Schema.Literals(["a4", "letter"])
export type ExcelPageSize = typeof ExcelPageSizeSchema.Type

export const ExcelOrientationSchema = Schema.Literals(["landscape", "portrait"])
export type ExcelOrientation = typeof ExcelOrientationSchema.Type

export const ExcelPdfFormSchema = Schema.Struct({
  pageSize: ExcelPageSizeSchema,
  orientation: ExcelOrientationSchema,
})

export type ExcelPdfFormValues = typeof ExcelPdfFormSchema.Type
