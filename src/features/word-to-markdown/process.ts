import { Effect } from "effect"

import { WordToMarkdownError } from "@/infrastructure/errors/document-conversion"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_DOCX_BYTES, MAX_DOCX_DOCUMENT_XML_BYTES } from "@/libs/schemas/document"
import type { DocumentConversionOutput } from "@/features/document-tools/types"

import { extractMarkdownFromDocx } from "./document"

export const convertWordToMarkdown = (file: File) =>
  runEffect(
    Effect.gen(function* () {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        return yield* new WordToMarkdownError({ message: "Choose a .docx Word document." })
      }

      if (file.size === 0 || file.size > MAX_DOCX_BYTES) {
        return yield* new WordToMarkdownError({
          message:
            file.size === 0
              ? "This Word document is empty."
              : `Word documents can be at most ${MAX_DOCX_BYTES / 1024 / 1024} MB.`,
        })
      }

      const markdown = yield* Effect.tryPromise({
        try: async () => extractMarkdownFromDocx(new Uint8Array(await file.arrayBuffer())),
        catch: () =>
          new WordToMarkdownError({
            message: "Could not read this Word document. Check that it is a valid .docx file.",
          }),
      })

      if (!markdown) {
        return yield* new WordToMarkdownError({
          message: `No readable text was found, or the document content exceeds the ${MAX_DOCX_DOCUMENT_XML_BYTES / 1024 / 1024} MB safety limit.`,
        })
      }

      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })

      return {
        blob,
        fileName: `${file.name.replace(/\.docx$/i, "") || "document"}.md`,
        inputBytes: file.size,
        outputBytes: blob.size,
        text: markdown,
      } satisfies DocumentConversionOutput
    }),
  )
