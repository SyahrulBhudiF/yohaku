import { useForm } from "@tanstack/react-form"
import { Schema } from "effect"
import { DownloadIcon, FileTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_PDF_BYTES,
  PdfToMarkdownFormSchema,
  type PdfToMarkdownFormValues,
} from "@/libs/schemas/pdf"
import { usePdfToMarkdown } from "../use-pdf-to-markdown"

export function PdfToMarkdownPage() {
  const model = usePdfToMarkdown()
  const error = model.selectionError ?? model.convert.error?.message
  const form = useForm({
    defaultValues: {
      recognizeScannedPages: true,
      preferAccuracy: false,
    } as PdfToMarkdownFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(PdfToMarkdownFormSchema) },
    listeners: {
      onChange: () => {
        model.convert.reset()
        model.clearResult()
      },
    },
    onSubmit: ({ value }) => {
      if (!model.file) return

      model.convert.mutate({
        file: model.file,
        ...value,
        onProgress: (progress) => model.setProgress(progress),
      })
    },
  })
  const pendingLabel =
    model.progress?.phase === "loading-model"
      ? "Loading OCR model…"
      : model.progress?.phase === "scanning"
        ? `Checking PDF page ${model.progress.pageNumber} of ${model.progress.pageCount}…`
        : model.progress?.phase === "recognizing"
          ? `Reading scanned ${model.progress.pageEndNumber ? "pages" : "page"} ${model.progress.pageNumber}${model.progress.pageEndNumber ? `–${model.progress.pageEndNumber}` : ""} of ${model.progress.pageCount}…`
          : model.progress?.phase === "rendering"
            ? `Rendering scanned ${model.progress.pageEndNumber ? "pages" : "page"} ${model.progress.pageNumber}${model.progress.pageEndNumber ? `–${model.progress.pageEndNumber}` : ""} of ${model.progress.pageCount}…`
            : "Reading PDF…"

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-to-markdown" japanese="PDFからMarkdownへ">
        <h1 className="text-3xl font-normal tracking-tight">PDF to Markdown</h1>
        <p className="text-muted-foreground">
          Convert selectable PDF text and scanned pages into Markdown with page breaks.
        </p>
      </ToolPageHeader>
      <FileDropzone
        accept="application/pdf,.pdf"
        file={model.file}
        icon={FileTextIcon}
        helperText={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
        onSelect={model.selectFile}
        onRemove={model.clear}
      />
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="recognizeScannedPages">
          {(field) => (
            <label
              htmlFor="pdf-to-markdown-ocr"
              aria-label="Recognize scanned pages with OCR"
              className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4"
            >
              <input
                id="pdf-to-markdown-ocr"
                type="checkbox"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
                disabled={model.convert.isPending}
                className="mt-1 size-4 accent-primary"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">Recognize scanned pages with OCR</span>
                <span className="text-sm text-muted-foreground">
                  First use downloads recognition data; your PDF stays in this browser. Up to 100
                  scanned pages per file.
                </span>
              </span>
            </label>
          )}
        </form.Field>
        <form.Field name="preferAccuracy">
          {(field) => (
            <label
              htmlFor="pdf-to-markdown-accuracy"
              aria-label="Prefer higher OCR accuracy"
              className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4"
            >
              <input
                id="pdf-to-markdown-accuracy"
                type="checkbox"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
                disabled={model.convert.isPending}
                className="mt-1 size-4 accent-primary"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">Prefer higher accuracy</span>
                <span className="text-sm text-muted-foreground">
                  Uses a larger first download and can take longer. Recommended for Japanese text,
                  faint scans, and dense pages.
                </span>
              </span>
            </label>
          )}
        </form.Field>
        <p className="text-sm text-muted-foreground">
          Complex columns and visual formatting may not keep their original layout. Files are
          processed locally and never uploaded.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
          >
            {error}
          </p>
        )}
        {model.progress && (
          <output aria-live="polite" className="text-sm text-muted-foreground">
            {pendingLabel}
          </output>
        )}
        {model.file && !model.result && (
          <Button
            type="submit"
            className="self-end"
            disabled={model.convert.isPending}
            aria-busy={model.convert.isPending}
          >
            <DownloadIcon />
            {model.convert.isPending ? pendingLabel : "Convert to Markdown"}
          </Button>
        )}
      </form>
      {model.result && (
        <>
          <ConversionResult {...model.result} />
          {model.result.text && (
            <pre className="max-h-96 overflow-auto rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface">
              {model.result.text}
            </pre>
          )}
        </>
      )}
    </main>
  )
}
