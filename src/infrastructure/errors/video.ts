import { Schema } from "effect"

export class VideoToMp3Error extends Schema.TaggedError<
  VideoToMp3Error,
  { readonly brand: unique symbol }
>()("VideoToMp3Error", { message: Schema.String }) {}

export class VideoToGifError extends Schema.TaggedError<
  VideoToGifError,
  { readonly brand: unique symbol }
>()("VideoToGifError", { message: Schema.String }) {}
