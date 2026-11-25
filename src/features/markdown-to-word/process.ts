import { Effect, Schema } from "effect"
import { Packer } from "docx"

import { MarkdownToWordError } from "@/infrastructure/errors/document-conversion"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_MARKDOWN_BYTES, MarkdownFormSchema } from "@/libs/schemas/document"

import { createMarkdownDocument } from "./document"
import type { DocumentConversionOutput } from "@/features/document-tools/types"

const markdownToWordEffect = (input: unknown) =>
  Effect.gen(function* () {
    const values = yield* Effect.mapError(
      Schema.decodeUnknownEffect(MarkdownFormSchema)(input),
      () => new MarkdownToWordError({ message: "Enter valid Markdown text to convert." }),
    )
    const inputBytes = new TextEncoder().encode(values.markdown).byteLength

    if (!values.markdown.trim()) {
      return yield* new MarkdownToWordError({ message: "Enter Markdown text to convert." })
    }

    if (inputBytes > MAX_MARKDOWN_BYTES) {
      return yield* new MarkdownToWordError({
        message: `Markdown input can be up to ${MAX_MARKDOWN_BYTES / 1024 / 1024} MB.`,
      })
    }

    const blob = yield* Effect.tryPromise({
      try: () => Packer.toBlob(createMarkdownDocument(values.markdown)),
      catch: () => new MarkdownToWordError({ message: "Could not create the Word document." }),
    })

    return {
      blob,
      fileName: "document.docx",
      inputBytes,
      outputBytes: blob.size,
    } satisfies DocumentConversionOutput
  })

export const convertMarkdownToWord = (input: unknown) => runEffect(markdownToWordEffect(input))
