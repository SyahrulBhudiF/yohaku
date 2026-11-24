import { Schema } from "effect"

export class PdfToWordError extends Schema.TaggedError<
  PdfToWordError,
  { readonly brand: unique symbol }
>()("PdfToWordError", { message: Schema.String }) {}

export class PdfToExcelError extends Schema.TaggedError<
  PdfToExcelError,
  { readonly brand: unique symbol }
>()("PdfToExcelError", { message: Schema.String }) {}

export class PdfTextExtractionError extends Schema.TaggedError<
  PdfTextExtractionError,
  { readonly brand: unique symbol }
>()("PdfTextExtractionError", { message: Schema.String }) {}

export class WordToPdfError extends Schema.TaggedError<
  WordToPdfError,
  { readonly brand: unique symbol }
>()("WordToPdfError", { message: Schema.String }) {}
