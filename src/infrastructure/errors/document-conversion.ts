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

export class MarkdownToWordError extends Schema.TaggedError<
  MarkdownToWordError,
  { readonly brand: unique symbol }
>()("MarkdownToWordError", { message: Schema.String }) {}

export class MarkdownToPdfError extends Schema.TaggedError<
  MarkdownToPdfError,
  { readonly brand: unique symbol }
>()("MarkdownToPdfError", { message: Schema.String }) {}

export class WordToMarkdownError extends Schema.TaggedError<
  WordToMarkdownError,
  { readonly brand: unique symbol }
>()("WordToMarkdownError", { message: Schema.String }) {}

export class PdfToMarkdownError extends Schema.TaggedError<
  PdfToMarkdownError,
  { readonly brand: unique symbol }
>()("PdfToMarkdownError", { message: Schema.String }) {}

export class MarkdownFileReadError extends Schema.TaggedError<
  MarkdownFileReadError,
  { readonly brand: unique symbol }
>()("MarkdownFileReadError", { message: Schema.String }) {}
