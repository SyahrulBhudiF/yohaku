import { Schema } from "effect"

export class CsvExcelError extends Schema.TaggedError<
  CsvExcelError,
  { readonly brand: unique symbol }
>()("CsvExcelError", { message: Schema.String }) {}
