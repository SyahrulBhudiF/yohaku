import { DownloadIcon, FileTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { usePdfToMarkdown } from "../use-pdf-to-markdown"

export function PdfToMarkdownPage() {
  const model = usePdfToMarkdown()
  const error = model.selectionError ?? model.convert.error?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-to-markdown" japanese="PDFからMarkdownへ">
        <h1 className="text-3xl font-normal tracking-tight">PDF to Markdown</h1>
        <p className="text-muted-foreground">
          Extract selectable text from a PDF into Markdown, with page breaks and reading order.
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
      <p className="text-sm text-muted-foreground">
        This exports selectable text only. Scanned pages need OCR first, and complex columns or
        visual formatting may not keep their original layout. Files stay in your browser.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}
      {model.file && !model.result && (
        <Button
          className="self-end"
          disabled={model.convert.isPending}
          onClick={() => model.convert.mutate(model.file!)}
          aria-busy={model.convert.isPending}
        >
          <DownloadIcon />
          {model.convert.isPending ? "Extracting text…" : "Convert to Markdown"}
        </Button>
      )}
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
