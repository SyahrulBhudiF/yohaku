import { Schema } from "effect"

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_IMAGE_FILES = 50
export const MAX_IMAGE_TOTAL_BYTES = 250 * 1024 * 1024

export const ImageFormatSchema = Schema.Literals(["png", "jpeg", "webp", "avif", "gif", "tiff"])

export type ImageFormat = typeof ImageFormatSchema.Type

export const IMAGE_FORMATS = ImageFormatSchema.literals

export const QualitySchema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))

export const ImageToolFormatSchema = Schema.Union([
  ImageFormatSchema,
  Schema.Literal("original"),
  Schema.Literal("svg"),
])

export const ImageToolFormSchema = Schema.Struct({
  format: ImageToolFormatSchema,
  quality: QualitySchema,
})

export type ImageToolFormValues = typeof ImageToolFormSchema.Type

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

export const MAX_IMAGE_PIXELS = 24_000_000
export const MAX_VECTOR_SIDE = 1024

export const VectorPresetSchema = Schema.Literals(["high", "balanced", "line"])
export type VectorPreset = typeof VectorPresetSchema.Type
