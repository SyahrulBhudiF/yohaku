import { Schema } from "effect"

export const MAX_PDF_BYTES = 100 * 1024 * 1024
export const MAX_PDF_TOTAL_BYTES = 250 * 1024 * 1024
export const MAX_PDF_PAGES = 2_000
export const MAX_PDF_FILES = 50
export const MAX_SPLIT_OUTPUTS = 500

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
