import { Schema } from "effect"

import { ImageFormatSchema, QualitySchema } from "./image"

export const MAX_PDF_BYTES = 30 * 1024 * 1024
export const MAX_PDF_TOTAL_BYTES = 50 * 1024 * 1024
export const MAX_PDF_PAGES = 2_000
export const MAX_PDF_FILES = 50
export const MAX_SPLIT_OUTPUTS = 500
export const MAX_PDF_IMAGE_PAGES = 500
export const MAX_PDF_IMAGE_PIXELS = 50_000_000
export const MIN_PDF_PASSWORD_LENGTH = 8
export const MAX_PDF_PASSWORD_LENGTH = 128

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

export const PdfSplitFormSchema = Schema.Struct({
  mode: PdfSplitModeSchema,
  pagesPerFile: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_PDF_PAGES })),
})

export type PdfSplitFormValues = typeof PdfSplitFormSchema.Type

export const PdfImageDpiSchema = Schema.Literals([72, 150, 300])

export type PdfImageDpi = typeof PdfImageDpiSchema.Type

export const PdfImageFormSchema = Schema.Struct({
  format: ImageFormatSchema,
  quality: QualitySchema,
  dpi: PdfImageDpiSchema,
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
