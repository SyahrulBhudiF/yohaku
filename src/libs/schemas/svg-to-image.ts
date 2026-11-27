import { Schema } from "effect"

export const MAX_SVG_BYTES = 5 * 1024 * 1024
export const MAX_SVG_SIDE = 4096
export const MAX_SVG_PIXELS = 24_000_000

export const SvgOutputFormatSchema = Schema.Literals(["png", "webp"])
export type SvgOutputFormat = typeof SvgOutputFormatSchema.Type

export const SvgToImageFormSchema = Schema.Struct({
  format: SvgOutputFormatSchema,
  width: Schema.Int.check(Schema.isBetween({ minimum: 16, maximum: MAX_SVG_SIDE })),
  quality: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
})

export type SvgToImageFormValues = typeof SvgToImageFormSchema.Type

export const SvgToImageOutputSchema = Schema.Struct({
  blob: Schema.instanceOf(Blob),
  fileName: Schema.String,
  mimeType: Schema.String,
  inputBytes: Schema.Int,
  bytes: Schema.Int,
  width: Schema.Int,
  height: Schema.Int,
})

export type SvgToImageOutput = typeof SvgToImageOutputSchema.Type
