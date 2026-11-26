import { Schema } from "effect"

export class QrCodeProcessingError extends Schema.TaggedError<
  QrCodeProcessingError,
  { readonly brand: unique symbol }
>()("QrCodeProcessingError", { message: Schema.String }) {}
