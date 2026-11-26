import { Schema } from "effect"

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_IMAGE_FILES = 50
export const MAX_IMAGE_TOTAL_BYTES = 250 * 1024 * 1024

export const ImageFormatSchema = Schema.Literals(["png", "jpeg", "webp", "avif", "gif", "tiff"])

export type ImageFormat = typeof ImageFormatSchema.Type

export const ImageInputFormatSchema = Schema.Union([ImageFormatSchema, Schema.Literal("heic")])

export type ImageInputFormat = typeof ImageInputFormatSchema.Type

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

export const BatchImageFormatSchema = Schema.Union([ImageFormatSchema, Schema.Literal("original")])

export const BatchImageFormSchema = Schema.Struct({
  format: BatchImageFormatSchema,
  quality: QualitySchema,
})

export type BatchImageFormValues = typeof BatchImageFormSchema.Type

export const BatchImageInputFileSchema = Schema.Struct({
  id: Schema.String,
  file: Schema.instanceOf(File),
  name: Schema.String,
  size: Schema.Int,
})

export type BatchImageInputFile = typeof BatchImageInputFileSchema.Type

export const BatchCompressedItemSchema = Schema.Struct({
  id: Schema.String,
  fileName: Schema.String,
  inputBytes: Schema.Int,
  outputBytes: Schema.Int,
  mimeType: Schema.String,
})

export type BatchCompressedItem = typeof BatchCompressedItemSchema.Type

export const BatchCompressedFailureSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  message: Schema.String,
})

export type BatchCompressedFailure = typeof BatchCompressedFailureSchema.Type

export const BatchCompressInputSchema = Schema.Struct({
  files: Schema.Array(BatchImageInputFileSchema).check(Schema.isMaxLength(MAX_IMAGE_FILES)),
  format: BatchImageFormatSchema,
  quality: QualitySchema,
})

export type BatchCompressInput = {
  readonly files: ReadonlyArray<BatchImageInputFile>
  readonly format: BatchImageFormValues["format"]
  readonly quality: number
}

export const BatchCompressOutputSchema = Schema.Struct({
  blob: Schema.instanceOf(Blob),
  fileName: Schema.String,
  inputBytes: Schema.Int,
  outputBytes: Schema.Int,
  zipBytes: Schema.Int,
  items: Schema.Array(BatchCompressedItemSchema),
  failures: Schema.Array(BatchCompressedFailureSchema),
})

export type BatchCompressOutput = typeof BatchCompressOutputSchema.Type

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
export const MAX_RESIZE_SIDE = 8_192

export const ImageResizeModeSchema = Schema.Literals(["fit", "fill", "stretch"])
export type ImageResizeMode = typeof ImageResizeModeSchema.Type

export const ImageCropAspectSchema = Schema.Literals(["free", "1:1", "4:3", "3:2", "16:9", "9:16"])
export type ImageCropAspect = typeof ImageCropAspectSchema.Type

export const CropRectSchema = Schema.Struct({
  x: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  y: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  width: Schema.Finite.check(Schema.isBetween({ minimum: 0.01, maximum: 1 })),
  height: Schema.Finite.check(Schema.isBetween({ minimum: 0.01, maximum: 1 })),
})

export type CropRect = typeof CropRectSchema.Type

export const ImageResizeFormatSchema = Schema.Union([ImageFormatSchema, Schema.Literal("original")])
export type ImageResizeFormat = typeof ImageResizeFormatSchema.Type

export const ImageResizeFormSchema = Schema.Struct({
  width: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_RESIZE_SIDE })),
  height: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_RESIZE_SIDE })),
  lockAspect: Schema.Boolean,
  mode: ImageResizeModeSchema,
  crop: CropRectSchema,
  cropAspect: ImageCropAspectSchema,
  rotate: Schema.Literals([0, 90, 180, 270]),
  flipX: Schema.Boolean,
  flipY: Schema.Boolean,
  format: ImageResizeFormatSchema,
  quality: QualitySchema,
})

export type ImageResizeFormValues = typeof ImageResizeFormSchema.Type

export const VectorPresetSchema = Schema.Literals(["high", "balanced", "line"])
export type VectorPreset = typeof VectorPresetSchema.Type
