import { useForm } from "@tanstack/react-form"
import { Schema } from "effect"
import { DownloadIcon, FileDownIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PdfDropzone } from "@/features/pdf-tools/components/pdf-dropzone"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PDF_BYTES, PdfUnlockFormSchema, type PdfUnlockFormValues } from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { useCompressPdf } from "../use-compress-pdf"

export function CompressPdfPage() {
  const model = useCompressPdf()
  const { file, result } = model
  const passwordForm = useForm({
    defaultValues: { password: "" } as PdfUnlockFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(PdfUnlockFormSchema) },
    onSubmit: ({ value }) => {
      if (file) {
        model.compress.mutate({ file, password: value.password })
      }
    },
  })
  const selectFile = (selected: File | undefined) => {
    passwordForm.reset()
    model.selectFile(selected)
  }
  const clear = () => {
    passwordForm.reset()
    model.clear()
  }
  const reduction = result ? result.inputBytes - result.outputBytes : 0
  const reduced = reduction > 0

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-compress" japanese="PDFを圧縮">
        <h1 className="text-3xl font-normal tracking-tight">Compress PDF</h1>
        <p className="text-muted-foreground">
          Reduce file size with lossless optimization. Everything runs in your browser.
        </p>
      </ToolPageHeader>
      {!file ? (
        <>
          <PdfDropzone
            disabled={model.compress.isPending}
            onFiles={(files) => selectFile(files[0])}
            hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
          />
          {model.error && (
            <p role="alert" className="text-sm text-on-error-container">
              {model.error}
            </p>
          )}
        </>
      ) : (
        <Card size="sm">
          <CardContent className="flex items-center gap-4 p-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <FileDownIcon />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{file.name}</span>
              <span className="text-sm text-muted-foreground">{formatBytes(file.size)}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={clear} aria-label="Remove PDF">
              <XIcon />
            </Button>
          </CardContent>
        </Card>
      )}
      {(model.error || model.compress.error) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-error-container p-3 text-on-error-container"
        >
          <span>{model.error ?? model.compress.error?.message}</span>
          {model.compress.error?._tag === "PdfPasswordError" && (
            <form
              className="flex shrink-0 gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void passwordForm.handleSubmit()
              }}
            >
              <passwordForm.Field name="password">
                {(field) => (
                  <Input
                    aria-label="PDF password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="PDF password"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="w-44 bg-surface text-foreground"
                  />
                )}
              </passwordForm.Field>
              <passwordForm.Subscribe selector={(state) => state.values.password}>
                {(password) => (
                  <Button type="submit" size="sm" disabled={!password || model.compress.isPending}>
                    Unlock
                  </Button>
                )}
              </passwordForm.Subscribe>
            </form>
          )}
        </div>
      )}
      {file && !result && model.compress.error?._tag !== "PdfPasswordError" && (
        <Button
          className="self-end"
          disabled={model.compress.isPending}
          onClick={() => model.compress.mutate({ file })}
        >
          <FileDownIcon />
          {model.compress.isPending ? "Optimizing PDF…" : "Compress PDF"}
        </Button>
      )}
      {result && (
        <div className="rounded-xl bg-tertiary-container p-4 text-on-tertiary-container">
          <p className="font-medium">
            {reduced ? `Reduced by ${formatBytes(reduction)}` : "Already optimized"}
          </p>
          <p className="mt-1 text-sm">
            {formatBytes(result.inputBytes)} → {formatBytes(result.outputBytes)} · {result.pages}{" "}
            {result.pages === 1 ? "page" : "pages"}
            {!reduced && " · No quality loss"}
          </p>
          <Button
            className="mt-3"
            render={
              <a href={result.url} download={result.fileName} aria-label="Download optimized PDF" />
            }
            nativeButton={false}
          >
            <DownloadIcon />
            Download optimized PDF
          </Button>
        </div>
      )}
    </div>
  )
}
