import { Schema } from "effect"

export class VideoToMp3Error extends Schema.TaggedError<
  VideoToMp3Error,
  { readonly brand: unique symbol }
>()("VideoToMp3Error", { message: Schema.String }) {}
