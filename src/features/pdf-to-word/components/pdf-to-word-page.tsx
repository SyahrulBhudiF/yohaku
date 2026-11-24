import { DownloadIcon, FileTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConversionResult } from "@/features/document-tools/components/conversion-result"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { usePdfToWord } from "../use-pdf-to-word"

export function PdfToWordPage() {
  const model = usePdfToWord()
  const error = model.selectionError ?? model.convert.error?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-to-word" japanese="PDFをWordに変換">
        <h1 className="text-3xl font-normal tracking-tight">PDF to Word</h1>
        <p className="text-muted-foreground">
          Extract selectable text into an editable Word document. Files stay in your browser.
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
        Text and approximate reading order are preserved; complex layouts may shift. Scanned PDFs
        need OCR and are not supported.
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
          {model.convert.isPending ? "Converting PDF…" : "Convert to Word"}
        </Button>
      )}
      {model.result && (
        <ConversionResult
          url={model.result.url}
          fileName={model.result.fileName}
          inputBytes={model.result.inputBytes}
          outputBytes={model.result.outputBytes}
          detail={`${model.result.pages} ${model.result.pages === 1 ? "page" : "pages"}`}
        />
      )}
    </main>
  )
}
