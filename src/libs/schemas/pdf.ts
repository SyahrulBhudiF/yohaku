import { Schema } from "effect"

import { ImageFormatSchema, QualitySchema } from "./image"

export const MAX_PDF_BYTES = 100 * 1024 * 1024
export const MAX_PDF_TOTAL_BYTES = 250 * 1024 * 1024
export const MAX_PDF_PAGES = 2_000
export const MAX_PDF_FILES = 50
export const MAX_SPLIT_OUTPUTS = 500
export const MAX_PDF_IMAGE_PAGES = 500
export const MAX_PDF_IMAGE_PIXELS = 50_000_000

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
