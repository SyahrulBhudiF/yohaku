import { Loader2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { InlineError } from "@/features/tools/components/inline-error"
import { PasswordPrompt } from "@/features/pdf-tools/components/password-prompt"
import { PageGrid } from "@/features/pdf-tools/components/page-grid"
import { PdfDropzone } from "@/features/pdf-tools/components/pdf-dropzone"
import { PdfFileCard } from "@/features/pdf-tools/components/pdf-file-card"
import { usePdfFile } from "@/features/pdf-tools/use-pdf-file"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { usePdfReorganize } from "../use-pdf-reorganize"

export function PdfReorganizePage() {
  const model = usePdfReorganize()
  const [error, setError] = useState<string | null>(null)
  const pdf = usePdfFile({
    setFile: model.setFile,
    reset: model.clear,
    invalidMessage: "Choose a PDF file.",
    onReset: () => setError(null),
  })
  const errorMessage = error ?? pdf.error ?? model.reorganize.error?.message ?? null

  const updatePages = (pages: Parameters<typeof model.setPages>[0]) => {
    model.reorganize.reset()
    setError(null)
    model.setPages(pages)
  }

  const rotatePage = (pageId: string) => {
    model.reorganize.reset()
    setError(null)
    model.rotatePage(pageId)
  }

  const removePage = (pageId: string) => {
    model.reorganize.reset()
    setError(null)
    model.removePage(pageId)
  }

  const handleReorganize = () => {
    if (!model.file) return
    void model.reorganize.mutateAsync({ file: model.file, pages: model.pages }).catch(() => null)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <ToolPageHeader id="pdf-reorganize" japanese="PDFのページを整理">
        <h1 className="text-3xl font-normal tracking-tight">Reorganize PDF pages</h1>
        <p className="text-muted-foreground">
          Drag pages to reorder them, rotate individual pages, or remove pages. Everything runs in
          your browser.
        </p>
      </ToolPageHeader>

      {!model.file && !pdf.pending && (
        <PdfDropzone
          disabled={pdf.isReading}
          onFiles={(files) => void pdf.select(files)}
          hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
          label={pdf.isReading ? "Reading PDF…" : undefined}
        />
      )}

      {pdf.pending && (
        <PasswordPrompt
          name={pdf.pending.file.name}
          size={pdf.pending.file.size}
          message={pdf.pending.message}
          busy={pdf.isUnlocking}
          onUnlock={(password) => void pdf.unlock(password)}
          onRemove={pdf.remove}
        />
      )}

      {model.file && (
        <>
          <PdfFileCard file={model.file} onRemove={pdf.remove} />

          <PageGrid
            pages={model.pages}
            files={[model.file]}
            onReorder={updatePages}
            onRotate={rotatePage}
            onRemove={removePage}
            minPagesToKeep={1}
          />

          <p className="text-xs text-muted-foreground">
            Use the grip to drag pages. Rotation changes are saved when you reorganize the PDF.
          </p>

          <InlineError>{errorMessage}</InlineError>

          <Button
            className="self-end"
            disabled={model.reorganize.isPending || model.pages.length === 0}
            onClick={handleReorganize}
          >
            {model.reorganize.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {model.reorganize.isPending ? "Saving pages…" : "Save reorganized PDF"}
          </Button>

          {model.result && (
            <ConversionResult
              url={model.result.url}
              fileName={model.result.fileName}
              inputBytes={model.result.inputBytes}
              outputBytes={model.result.bytes}
              detail={`${model.result.pages} ${model.result.pages === 1 ? "page" : "pages"}`}
            />
          )}
        </>
      )}

      {!model.file && !pdf.pending && errorMessage && <InlineError>{errorMessage}</InlineError>}
    </div>
  )
}
