import { Schema } from "effect"

export class FileTooLargeError extends Schema.TaggedError<
  FileTooLargeError,
  { readonly brand: unique symbol }
>()("FileTooLargeError", {
  message: Schema.String,
  maxBytes: Schema.Int,
}) {}

export class UnsupportedFormatError extends Schema.TaggedError<
  UnsupportedFormatError,
  { readonly brand: unique symbol }
>()("UnsupportedFormatError", { message: Schema.String }) {}

export class ImageProcessingError extends Schema.TaggedError<
  ImageProcessingError,
  { readonly brand: unique symbol }
>()("ImageProcessingError", {
  message: Schema.String,
}) {}
