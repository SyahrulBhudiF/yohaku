import { DownloadIcon, FileType2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_DOCX_BYTES } from "@/libs/schemas/document"
import { useWordToMarkdown } from "../use-word-to-markdown"

export function WordToMarkdownPage() {
  const model = useWordToMarkdown()
  const error = model.selectionError ?? model.convert.error?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="word-to-markdown" japanese="WordからMarkdownへ">
        <h1 className="text-3xl font-normal tracking-tight">Word to Markdown</h1>
        <p className="text-muted-foreground">
          Extract text, headings, lists and tables from a DOCX file into Markdown locally.
        </p>
      </ToolPageHeader>
      <FileDropzone
        accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        file={model.file}
        icon={FileType2Icon}
        helperText={`DOCX only · up to ${MAX_DOCX_BYTES / 1024 / 1024} MB`}
        onSelect={model.selectFile}
        onRemove={model.clear}
      />
      <p className="text-sm text-muted-foreground">
        Text formatting, heading levels, lists, and simple tables are converted. Images, page
        layout, and other visual formatting are not preserved. Legacy .doc files are not supported.
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
