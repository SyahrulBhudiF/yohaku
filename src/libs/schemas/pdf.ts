import { Schema } from "effect"

import { ImageFormatSchema, QualitySchema } from "./image"

export const MAX_PDF_BYTES = 30 * 1024 * 1024
export const MAX_PDF_TOTAL_BYTES = 50 * 1024 * 1024
export const MAX_PDF_PAGES = 2_000
export const MAX_PDF_FILES = 50
export const MAX_SPLIT_OUTPUTS = 500
export const MAX_PDF_IMAGE_PAGES = 500
export const MAX_PDF_IMAGE_PIXELS = 50_000_000
export const MAX_PDF_OCR_PAGES = 100
export const MAX_PDF_OCR_BATCH_PAGES = 4
export const MAX_PDF_OCR_IMAGE_PIXELS = 8_000_000
export const MAX_PDF_OCR_IMAGE_SIDE = 640
export const MAX_PDF_OCR_SPEED_IMAGE_SIDE = 480
export const MIN_PDF_PASSWORD_LENGTH = 8
export const MAX_PDF_PASSWORD_LENGTH = 128

export const PdfToMarkdownFormSchema = Schema.Struct({
  recognizeScannedPages: Schema.Boolean,
  preferAccuracy: Schema.Boolean,
})

export type PdfToMarkdownFormValues = typeof PdfToMarkdownFormSchema.Type

export const PdfOcrQualitySchema = Schema.Literals(["speed", "accuracy"])

export type PdfOcrQuality = typeof PdfOcrQualitySchema.Type

export const PdfOcrProgressSchema = Schema.Struct({
  phase: Schema.Literals(["scanning", "rendering", "loading-model", "recognizing"]),
  pageNumber: Schema.Int.check(Schema.isGreaterThan(0)),
  pageEndNumber: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
  pageCount: Schema.Int.check(Schema.isGreaterThan(0)),
})

export type PdfOcrProgress = typeof PdfOcrProgressSchema.Type

export const PdfOcrLineSchema = Schema.Struct({
  text: Schema.String,
  x: Schema.Finite,
  y: Schema.Finite,
  width: Schema.Finite,
  height: Schema.Finite,
  score: Schema.Finite,
})

export type PdfOcrLine = typeof PdfOcrLineSchema.Type

export const PdfOcrPagesSchema = Schema.Array(Schema.Array(PdfOcrLineSchema))

const PdfPasswordSchema = Schema.String.check(
  Schema.isMinLength(MIN_PDF_PASSWORD_LENGTH),
  Schema.isMaxLength(MAX_PDF_PASSWORD_LENGTH),
)

export const PdfProtectFormSchema = Schema.Struct({
  password: PdfPasswordSchema,
  confirmation: Schema.String,
})

export type PdfProtectFormValues = typeof PdfProtectFormSchema.Type

export const PdfUnlockFormSchema = Schema.Struct({
  password: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_PDF_PASSWORD_LENGTH)),
})

export type PdfUnlockFormValues = typeof PdfUnlockFormSchema.Type

export const PdfPageRangeSchema = Schema.Struct({
  start: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_PDF_PAGES })),
  end: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_PDF_PAGES })),
})

export type PdfPageRange = typeof PdfPageRangeSchema.Type

export const PdfSplitModeSchema = Schema.Literals(["every", "chunks", "ranges"])

export type PdfSplitMode = typeof PdfSplitModeSchema.Type

export const PdfSplitRangeSchema = Schema.Struct({
  id: Schema.String,
  start: Schema.String,
  end: Schema.String,
})

export type PdfSplitRange = typeof PdfSplitRangeSchema.Type

export const PdfSplitFormSchema = Schema.Struct({
  mode: PdfSplitModeSchema,
  pagesPerFile: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_PDF_PAGES })),
  ranges: Schema.Array(PdfSplitRangeSchema),
})

export type PdfSplitFormValues = typeof PdfSplitFormSchema.Type

export const PdfExtractFormSchema = Schema.Struct({
  selection: Schema.String.check(Schema.isMaxLength(10_000)),
})

export type PdfExtractFormValues = typeof PdfExtractFormSchema.Type

export const PdfAnnotateModeSchema = Schema.Literals(["numbers", "watermark"])
export type PdfAnnotateMode = typeof PdfAnnotateModeSchema.Type

export const PdfNumberPositionSchema = Schema.Literals([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
])
export type PdfNumberPosition = typeof PdfNumberPositionSchema.Type

export const PdfNumberFormatSchema = Schema.Literals(["number", "page-number", "number-total"])
export type PdfNumberFormat = typeof PdfNumberFormatSchema.Type

export const PdfWatermarkKindSchema = Schema.Literals(["text", "image"])
export type PdfWatermarkKind = typeof PdfWatermarkKindSchema.Type

export const PdfWatermarkPlacementSchema = Schema.Literals(["single", "tiled"])
export type PdfWatermarkPlacement = typeof PdfWatermarkPlacementSchema.Type

export const PdfAnnotateFormSchema = Schema.Struct({
  mode: PdfAnnotateModeSchema,
  pageSelection: Schema.String.check(Schema.isMaxLength(10_000)),
  numberStart: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 9_999 })),
  skipFirstPage: Schema.Boolean,
  numberFormat: PdfNumberFormatSchema,
  numberPosition: PdfNumberPositionSchema,
  numberFontSize: Schema.Int.check(Schema.isBetween({ minimum: 8, maximum: 72 })),
  numberMargin: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 144 })),
  watermarkKind: PdfWatermarkKindSchema,
  watermarkText: Schema.String.check(Schema.isMaxLength(200)),
  watermarkPlacement: PdfWatermarkPlacementSchema,
  watermarkOpacity: Schema.Int.check(Schema.isBetween({ minimum: 5, maximum: 100 })),
  watermarkRotation: Schema.Int.check(Schema.isBetween({ minimum: -180, maximum: 180 })),
  watermarkFontSize: Schema.Int.check(Schema.isBetween({ minimum: 12, maximum: 200 })),
  watermarkScale: Schema.Int.check(Schema.isBetween({ minimum: 5, maximum: 100 })),
})

export type PdfAnnotateFormValues = typeof PdfAnnotateFormSchema.Type

export const PdfImageDpiSchema = Schema.Literals([72, 150, 300])

export type PdfImageDpi = typeof PdfImageDpiSchema.Type

export const PdfImageFormSchema = Schema.Struct({
  format: ImageFormatSchema,
  quality: QualitySchema,
  dpi: PdfImageDpiSchema,
  pageSelection: Schema.String.check(Schema.isMaxLength(10_000)),
})

export type PdfImageFormValues = typeof PdfImageFormSchema.Type

export const ImagePdfModeSchema = Schema.Literals(["one", "separate"])

export type ImagePdfMode = typeof ImagePdfModeSchema.Type

export const ImagePdfPageSizeSchema = Schema.Literals(["fit", "a4"])

export type ImagePdfPageSize = typeof ImagePdfPageSizeSchema.Type

export const ImagePdfFormSchema = Schema.Struct({
  mode: ImagePdfModeSchema,
  pageSize: ImagePdfPageSizeSchema,
  quality: QualitySchema,
})

export type ImagePdfFormValues = typeof ImagePdfFormSchema.Type
