import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { Loader2Icon, ScissorsIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { InlineError } from "@/features/tools/components/inline-error"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PDF_BYTES, PdfExtractFormSchema, type PdfExtractFormValues } from "@/libs/schemas/pdf"
import { parsePageSelection } from "@/libs/utils/pdf/ranges"
import { extractPdfPages } from "../process"
import { usePdfExtractStore } from "../store"
import { usePdfFile } from "../use-pdf-file"
import { PasswordPrompt } from "./password-prompt"
import { PdfDropzone } from "./pdf-dropzone"
import { PdfFileCard } from "./pdf-file-card"

export function ExtractPage() {
  const { file, result, setFile, setResult, reset } = usePdfExtractStore()
  const extract = useMutation({
    mutationFn: extractPdfPages,
    onSuccess: setResult,
  })
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { selection: "" } as PdfExtractFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(PdfExtractFormSchema) },
    listeners: {
      onChange: () => {
        extract.reset()
        setError(null)
      },
    },
    onSubmit: async ({ value }) => {
      if (!file) return

      const parsed = parsePageSelection(value.selection, file.pageCount)

      if (!parsed.ok) {
        setError(parsed.message)

        return
      }

      if (parsed.pages.length === 0) {
        setError("Choose at least one page.")

        return
      }

      setError(null)
      await extract.mutateAsync({ file, pages: parsed.pages }).catch(() => null)
    },
  })
  const pdf = usePdfFile({
    setFile,
    reset,
    invalidMessage: "Only PDF files can be extracted.",
    onReset: () => {
      form.reset()
      setError(null)
    },
    onSelected: (entry) => {
      form.setFieldValue("selection", entry.pageCount === 1 ? "1" : `1-${entry.pageCount}`)
    },
  })
  const selection = form.state.values.selection
  const parsed = file ? parsePageSelection(selection, file.pageCount) : null
  const errorMessage =
    error ?? pdf.error ?? extract.error?.message ?? (parsed && !parsed.ok ? parsed.message : null)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-extract" japanese="PDFのページを抽出">
        <h1 className="text-3xl font-normal tracking-tight">Extract PDF pages</h1>
        <p className="text-muted-foreground">
          Choose pages to keep and download them as a new PDF. Your file stays in this browser.
        </p>
      </ToolPageHeader>

      {!file && !pdf.pending && (
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

      {file && (
        <>
          <PdfFileCard file={file} onRemove={pdf.remove} disabled={extract.isPending} />

          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="selection">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="extract-pages" className="text-sm font-medium">
                    Pages to keep
                  </label>
                  <Input
                    id="extract-pages"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={`e.g. 1-3, 5, 8-${file.pageCount}`}
                    aria-describedby="extract-help"
                  />
                  <p id="extract-help" className="text-xs text-muted-foreground">
                    Enter page numbers and ranges separated by commas. Pages are kept in ascending
                    order; overlapping ranges are ignored.
                  </p>
                </div>
              )}
            </form.Field>

            <InlineError>{errorMessage}</InlineError>

            {result && (
              <ConversionResult
                url={result.url}
                fileName={result.fileName}
                inputBytes={result.inputBytes}
                outputBytes={result.bytes}
                detail={`${result.pages} ${result.pages === 1 ? "page" : "pages"}`}
              />
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={extract.isPending || !selection.trim()}>
                {extract.isPending ? (
                  <>
                    <Loader2Icon className="animate-spin" /> Extracting…
                  </>
                ) : (
                  <>
                    <ScissorsIcon /> Extract pages
                  </>
                )}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
