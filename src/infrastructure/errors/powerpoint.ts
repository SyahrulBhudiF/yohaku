import { Schema } from "effect"

export class PowerPointProcessingError extends Schema.TaggedError<
  PowerPointProcessingError,
  { readonly brand: unique symbol }
>()("PowerPointProcessingError", { message: Schema.String }) {}
