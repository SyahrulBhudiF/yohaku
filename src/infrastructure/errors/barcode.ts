import { Schema } from "effect"

export class BarcodeProcessingError extends Schema.TaggedError<
  BarcodeProcessingError,
  { readonly brand: unique symbol }
>()("BarcodeProcessingError", { message: Schema.String }) {}
