import { Schema } from "effect"

export class SvgToImageError extends Schema.TaggedError<
  SvgToImageError,
  { readonly brand: unique symbol }
>()("SvgToImageError", {
  message: Schema.String,
}) {}
