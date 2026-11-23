import { Schema } from "effect"

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024

export const ImageFormatSchema = Schema.Literals(["png", "jpeg", "webp", "avif", "gif", "tiff"])

export type ImageFormat = typeof ImageFormatSchema.Type

export const IMAGE_FORMATS = ImageFormatSchema.literals

export const QualitySchema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))

export const FormDataQualitySchema = Schema.FiniteFromString.pipe(Schema.decodeTo(QualitySchema))

export const ConvertOptionsSchema = Schema.Struct({
  format: ImageFormatSchema,
  quality: QualitySchema,
})

export type ConvertOptions = typeof ConvertOptionsSchema.Type

export const CompressOptionsSchema = Schema.Struct({
  quality: QualitySchema,
  format: Schema.optionalKey(ImageFormatSchema),
})

export type CompressOptions = typeof CompressOptionsSchema.Type

export const ImageResultSchema = Schema.Struct({
  fileName: Schema.String,
  mimeType: Schema.String,
  originalBytes: Schema.Int,
  resultBytes: Schema.Int,
})

export type ImageResult = typeof ImageResultSchema.Type

export const ApiErrorSchema = Schema.Struct({
  _tag: Schema.String,
  message: Schema.String,
})

export type ApiError = typeof ApiErrorSchema.Type

export const IMAGE_MIME: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  tiff: "image/tiff",
}

export const IMAGE_EXTENSION: Record<ImageFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  avif: "avif",
  gif: "gif",
  tiff: "tiff",
}
