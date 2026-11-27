import { Schema } from "effect"

export class ImageOcrError extends Schema.TaggedError<
  ImageOcrError,
  { readonly brand: unique symbol }
>()("ImageOcrError", { message: Schema.String }) {}
