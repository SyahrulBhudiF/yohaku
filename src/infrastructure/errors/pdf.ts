import { Schema } from "effect"

export class PdfPasswordError extends Schema.TaggedError<
  PdfPasswordError,
  { readonly brand: unique symbol }
>()("PdfPasswordError", {
  message: Schema.String,
}) {}

export class PdfProcessingError extends Schema.TaggedError<
  PdfProcessingError,
  { readonly brand: unique symbol }
>()("PdfProcessingError", {
  message: Schema.String,
}) {}
