import { Effect, Schema } from "effect"
import { Packer } from "docx"

import { MarkdownToPdfError, WordToPdfError } from "@/infrastructure/errors/document-conversion"
import { runEffect } from "@/infrastructure/runtime"
import { convertWordToPdfEffect } from "@/features/word-to-pdf/process"
import { MAX_MARKDOWN_BYTES, MarkdownFormSchema } from "@/libs/schemas/document"

import { createMarkdownDocument } from "@/features/markdown-to-word/document"
import type { DocumentConversionOutput } from "@/features/document-tools/types"

const markdownToPdfEffect = (input: unknown) =>
  Effect.gen(function* () {
    const values = yield* Effect.mapError(
      Schema.decodeUnknownEffect(MarkdownFormSchema)(input),
      () => new MarkdownToPdfError({ message: "Enter valid Markdown text to convert." }),
    )
    const inputBytes = new TextEncoder().encode(values.markdown).byteLength

    if (!values.markdown.trim()) {
      return yield* new MarkdownToPdfError({ message: "Enter Markdown text to convert." })
    }

    if (inputBytes > MAX_MARKDOWN_BYTES) {
      return yield* new MarkdownToPdfError({
        message: `Markdown input can be up to ${MAX_MARKDOWN_BYTES / 1024 / 1024} MB.`,
      })
    }

    const docx = yield* Effect.tryPromise({
      try: () => Packer.toBlob(createMarkdownDocument(values.markdown)),
      catch: () => new MarkdownToPdfError({ message: "Could not prepare the Markdown document." }),
    })
    const docxFile = new File([docx], "document.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    const pdf = yield* Effect.mapError(
      convertWordToPdfEffect(docxFile),
      (error: WordToPdfError) => new MarkdownToPdfError({ message: error.message }),
    )

    return {
      blob: pdf.blob,
      fileName: "document.pdf",
      inputBytes,
      outputBytes: pdf.outputBytes,
    } satisfies DocumentConversionOutput
  })

export const convertMarkdownToPdf = (input: unknown) => runEffect(markdownToPdfEffect(input))
