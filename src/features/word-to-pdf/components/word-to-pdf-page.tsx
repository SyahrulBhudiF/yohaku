import { FileDownIcon, FileType2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConversionResult } from "@/features/document-tools/components/conversion-result"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { MAX_DOCX_BYTES } from "@/libs/schemas/document"
import { useWordToPdf } from "../use-word-to-pdf"

export function WordToPdfPage() {
  const model = useWordToPdf()
  const error = model.selectionError ?? model.convert.error?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">Word to PDF</h1>
        <p className="text-muted-foreground">
          Render a Word document to PDF locally in your browser. Your file is never uploaded.
        </p>
      </header>
      <FileDropzone
        accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        file={model.file}
        icon={FileType2Icon}
        helperText={`DOCX only · up to ${MAX_DOCX_BYTES / 1024 / 1024} MB`}
        onSelect={model.selectFile}
        onRemove={model.clear}
      />
      <p className="text-sm text-muted-foreground">
        DOCX rendering runs in a background worker. Very large documents may take longer to finish.
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
          <FileDownIcon />
          {model.convert.isPending ? "Rendering PDF…" : "Convert to PDF"}
        </Button>
      )}
      {model.result && (
        <ConversionResult
          url={model.result.url}
          fileName={model.result.fileName}
          inputBytes={model.result.inputBytes}
          outputBytes={model.result.outputBytes}
        />
      )}
    </main>
  )
}
