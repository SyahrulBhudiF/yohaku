import { Schema } from "effect"

export const MAX_VIDEO_GIF_INPUT_BYTES = 100 * 1024 * 1024
export const MAX_VIDEO_GIF_SECONDS = 10
export const MAX_VIDEO_GIF_FPS = 15
export const MAX_VIDEO_GIF_FRAMES = MAX_VIDEO_GIF_SECONDS * MAX_VIDEO_GIF_FPS
export const MAX_VIDEO_GIF_SIDE = 480
export const MAX_VIDEO_GIF_PIXELS = 230_400
export const MAX_VIDEO_GIF_SOURCE_PIXELS = 50_000_000
export const MAX_VIDEO_GIF_OUTPUT_BYTES = 64 * 1024 * 1024

export const VIDEO_GIF_WIDTHS = [240, 360, 480] as const

export const VideoGifFormSchema = Schema.Struct({
  startSeconds: Schema.Finite.check(
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(600),
  ),
  endSeconds: Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(600)),
  fps: Schema.Int.check(Schema.isBetween({ minimum: 5, maximum: MAX_VIDEO_GIF_FPS })),
  width: Schema.Literals(VIDEO_GIF_WIDTHS),
})

export type VideoGifFormValues = typeof VideoGifFormSchema.Type

export const VideoToGifOutputSchema = Schema.Struct({
  blob: Schema.instanceOf(Blob),
  fileName: Schema.String,
  inputBytes: Schema.Int,
  outputBytes: Schema.Int,
})

export type VideoToGifOutput = typeof VideoToGifOutputSchema.Type
