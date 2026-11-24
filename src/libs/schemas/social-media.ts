import { Schema } from "effect"

export const MAX_SOCIAL_MEDIA_URL_LENGTH = 2_048
export const MAX_SOCIAL_MEDIA_CONTROL_BYTES = 8 * 1024 * 1024
export const MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES = 300 * 1024 * 1024
export const MAX_SOCIAL_MEDIA_AUDIO_BYTES = 100 * 1024 * 1024

export const SocialMediaPlatformSchema = Schema.Literals(["youtube", "instagram"])

export const SocialMediaUrlFormSchema = Schema.Struct({
  url: Schema.String.check(Schema.isMaxLength(MAX_SOCIAL_MEDIA_URL_LENGTH)),
})

export type SocialMediaUrlFormValues = typeof SocialMediaUrlFormSchema.Type

export const SocialMediaFormatSchema = Schema.Struct({
  url: Schema.String,
  mime_type: Schema.optional(Schema.NullOr(Schema.String)),
  container: Schema.optional(Schema.NullOr(Schema.String)),
  filesize: Schema.optional(Schema.NullOr(Schema.Finite)),
  bitrate: Schema.optional(Schema.NullOr(Schema.Finite)),
  http_headers: Schema.optional(Schema.Array(Schema.Tuple([Schema.String, Schema.String]))),
  video: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        width: Schema.optional(Schema.NullOr(Schema.Finite)),
        height: Schema.optional(Schema.NullOr(Schema.Finite)),
        fps: Schema.optional(Schema.NullOr(Schema.Finite)),
        codec: Schema.String,
      }),
    ),
  ),
  audio: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        codec: Schema.String,
        bitrate: Schema.optional(Schema.NullOr(Schema.Finite)),
        sample_rate: Schema.optional(Schema.NullOr(Schema.Finite)),
        channels: Schema.optional(Schema.NullOr(Schema.Finite)),
      }),
    ),
  ),
})

export const SocialMediaInfoSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  duration: Schema.optional(
    Schema.NullOr(Schema.Struct({ secs: Schema.Finite, nanos: Schema.Finite })),
  ),
  uploader: Schema.optional(Schema.NullOr(Schema.String)),
  webpage_url: Schema.String,
  is_live: Schema.Boolean,
  formats: Schema.Array(SocialMediaFormatSchema),
})

export const SocialMediaDownloadRequestSchema = Schema.Struct({
  url: Schema.String,
  platform: SocialMediaPlatformSchema,
  fileName: Schema.String,
  headers: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
})

export type SocialMediaPlatform = typeof SocialMediaPlatformSchema.Type
export type SocialMediaFormat = typeof SocialMediaFormatSchema.Type
export type SocialMediaInfo = typeof SocialMediaInfoSchema.Type
export type SocialMediaDownloadRequest = typeof SocialMediaDownloadRequestSchema.Type
