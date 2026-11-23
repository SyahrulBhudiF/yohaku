import { Schema } from "effect"

export class ExcelProcessingError extends Schema.TaggedError<
  ExcelProcessingError,
  { readonly brand: unique symbol }
>()("ExcelProcessingError", {
  message: Schema.String,
}) {}
