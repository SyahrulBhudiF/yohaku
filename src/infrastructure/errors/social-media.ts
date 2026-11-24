import { Schema } from "effect"

export class SocialMediaDownloaderError extends Schema.TaggedError<
  SocialMediaDownloaderError,
  { readonly brand: unique symbol }
>()("SocialMediaDownloaderError", {
  message: Schema.String,
}) {}
