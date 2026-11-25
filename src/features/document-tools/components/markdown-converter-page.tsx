import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { FileDownIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MarkdownEditor } from "@/features/document-tools/components/markdown-editor"
import { readMarkdownFile } from "@/features/document-tools/process"
import type { DocumentConversionStore } from "@/features/document-tools/conversion-result-store"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_MARKDOWN_CHARS,
  MarkdownFormSchema,
  type MarkdownFormValues,
} from "@/libs/schemas/document"
import type { DocumentConversionOutput } from "@/features/document-tools/types"

interface MarkdownConverterPageProps extends DocumentConversionStore {
  readonly id: string
  readonly japanese: string
  readonly title: string
  readonly description: string
  readonly actionLabel: string
  readonly pendingLabel: string
  readonly convert: (input: MarkdownFormValues) => Promise<DocumentConversionOutput>
}

export function MarkdownConverterPage({
  id,
  japanese,
  title,
  description,
  actionLabel,
  pendingLabel,
  convert: convertMarkdown,
  result,
  setResult,
  clearResult,
}: MarkdownConverterPageProps) {
  const convert = useMutation({ mutationFn: convertMarkdown, onSuccess: setResult })
  const readFile = useMutation({
    mutationFn: readMarkdownFile,
    onSuccess: (markdown) => {
      form.setFieldValue("markdown", markdown)
      clearResult()
      convert.reset()
    },
  })
  const form = useForm({
    defaultValues: { markdown: "" } as MarkdownFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(MarkdownFormSchema) },
    listeners: {
      onChange: () => {
        readFile.reset()
        clearResult()
        convert.reset()
      },
    },
    onSubmit: ({ value }) => {
      convert.mutate(value)
    },
  })
  const message = readFile.error?.message ?? convert.error?.message ?? null
  const markdown = form.state.values.markdown

  const handleFile = (file: File | undefined) => {
    if (file) readFile.mutate(file)
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id={id} japanese={japanese}>
        <h1 className="text-3xl font-normal tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </ToolPageHeader>
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="markdown">
          {(field) => (
            <MarkdownEditor
              value={field.state.value}
              onChange={field.handleChange}
              onFile={handleFile}
              disabled={readFile.isPending || convert.isPending}
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          {markdown.length.toLocaleString()} / {MAX_MARKDOWN_CHARS.toLocaleString()} characters
        </p>
        {message && (
          <p
            role="alert"
            className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
          >
            {message}
          </p>
        )}
        <Button
          type="submit"
          className="self-end"
          disabled={
            convert.isPending ||
            readFile.isPending ||
            !markdown.trim() ||
            markdown.length > MAX_MARKDOWN_CHARS
          }
        >
          {convert.isPending ? <Loader2Icon className="animate-spin" /> : <FileDownIcon />}
          {convert.isPending ? pendingLabel : actionLabel}
        </Button>
      </form>
      {result && <ConversionResult {...result} />}
    </main>
  )
}
