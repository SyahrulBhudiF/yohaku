import { Schema } from "effect"

export class FileTooLargeError extends Schema.TaggedError<
  FileTooLargeError,
  { readonly brand: unique symbol }
>()("FileTooLargeError", {
  message: Schema.String,
  maxBytes: Schema.Int,
}) {}

export class ImageProcessingError extends Schema.TaggedError<
  ImageProcessingError,
  { readonly brand: unique symbol }
>()("ImageProcessingError", {
  message: Schema.String,
}) {}

export class BatchImageError extends Schema.TaggedError<
  BatchImageError,
  { readonly brand: unique symbol }
>()("BatchImageError", {
  message: Schema.String,
}) {}
