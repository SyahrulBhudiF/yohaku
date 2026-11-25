import { Schema } from "effect"

export const MAX_DOCX_BYTES = 50 * 1024 * 1024
export const MAX_DOCX_DOCUMENT_XML_BYTES = 64 * 1024 * 1024
export const MAX_MARKDOWN_CHARS = 500_000
export const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024
export const MAX_MARKDOWN_FILE_BYTES = 2 * 1024 * 1024

export const MarkdownFormSchema = Schema.Struct({
  markdown: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_MARKDOWN_CHARS)),
})

export type MarkdownFormValues = typeof MarkdownFormSchema.Type
