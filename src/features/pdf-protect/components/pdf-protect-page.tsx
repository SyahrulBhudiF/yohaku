import { useForm } from "@tanstack/react-form"
import { DownloadIcon, FileLock2Icon, UnlockKeyholeIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Schema } from "effect"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PdfDropzone } from "@/features/pdf-tools/components/pdf-dropzone"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PDF_BYTES, PdfProtectFormSchema, PdfUnlockFormSchema } from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { isPdfFile } from "@/features/pdf-tools/validation"
import { usePdfProtect, type PdfProtectionMode } from "../use-pdf-protect"

export function PdfProtectPage() {
  const model = usePdfProtect()
  const [fileError, setFileError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const protectForm = useForm({
    defaultValues: { password: "", confirmation: "" },
    validators: { onChange: Schema.toStandardSchemaV1(PdfProtectFormSchema) },
    onSubmit: ({ value }) => {
      if (!model.file) return
      setFormError(null)

      if (value.password !== value.confirmation) {
        setFormError("The passwords do not match.")

        return
      }

      model.protect.mutate({ file: model.file, ...value })
    },
  })
  const unlockForm = useForm({
    defaultValues: { password: "" },
    validators: { onChange: Schema.toStandardSchemaV1(PdfUnlockFormSchema) },
    onSubmit: ({ value }) => {
      if (!model.file) return
      setFormError(null)
      model.unlock.mutate({ file: model.file, ...value })
    },
  })
  const operationError =
    model.mode === "protect" ? model.protect.error?.message : model.unlock.error?.message
  const error = fileError ?? formError ?? operationError

  const selectFile = (incoming: ReadonlyArray<File>) => {
    const file = incoming[0]

    if (!file) return

    model.clear()
    protectForm.reset()
    unlockForm.reset()
    setFileError(null)
    setFormError(null)

    if (!isPdfFile(file)) {
      setFileError("Choose a PDF file.")

      return
    }

    if (file.size === 0 || file.size > MAX_PDF_BYTES) {
      setFileError(
        file.size === 0
          ? "This PDF is empty."
          : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      )

      return
    }

    model.setFile(file)
  }

  const selectMode = (mode: PdfProtectionMode) => {
    protectForm.reset()
    unlockForm.reset()
    setFormError(null)
    model.selectMode(mode)
  }

  const clear = () => {
    model.clear()
    protectForm.reset()
    unlockForm.reset()
    setFileError(null)
    setFormError(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-protect" japanese="PDFの保護・解除">
        <h1 className="text-3xl font-normal tracking-tight">Protect or unlock PDF</h1>
        <p className="text-muted-foreground">
          Add or remove AES-256 password protection locally in your browser. Your password and PDF
          are never uploaded.
        </p>
      </ToolPageHeader>

      {!model.file ? (
        <PdfDropzone
          onFiles={(files) => selectFile(files)}
          hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
        />
      ) : (
        <Card size="sm">
          <CardContent className="flex items-center gap-4 p-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <FileLock2Icon />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{model.file.name}</span>
              <span className="text-sm text-muted-foreground">{formatBytes(model.file.size)}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={clear} aria-label="Remove PDF">
              <XIcon />
            </Button>
          </CardContent>
        </Card>
      )}

      {fileError && !model.file && (
        <p role="alert" className="text-sm text-on-error-container">
          {fileError}
        </p>
      )}

      {model.file && (
        <>
          <div
            className="flex w-fit rounded-full bg-surface-container-low p-1"
            aria-label="PDF action"
          >
            <Button
              type="button"
              size="sm"
              variant={model.mode === "protect" ? "secondary" : "ghost"}
              aria-pressed={model.mode === "protect"}
              onClick={() => selectMode("protect")}
            >
              <FileLock2Icon />
              Protect
            </Button>
            <Button
              type="button"
              size="sm"
              variant={model.mode === "unlock" ? "secondary" : "ghost"}
              aria-pressed={model.mode === "unlock"}
              onClick={() => selectMode("unlock")}
            >
              <UnlockKeyholeIcon />
              Unlock
            </Button>
          </div>

          {model.mode === "protect" ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void protectForm.handleSubmit()
              }}
            >
              <div className="flex flex-col gap-2">
                <protectForm.Field name="password">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="pdf-new-password" className="text-sm font-medium">
                        New password
                      </label>
                      <Input
                        id="pdf-new-password"
                        type="password"
                        autoComplete="new-password"
                        maxLength={128}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="At least 8 characters"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p role="alert" className="text-sm text-error">
                          Use a password between 8 and 128 characters.
                        </p>
                      )}
                    </div>
                  )}
                </protectForm.Field>
                <protectForm.Field name="confirmation">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="pdf-confirm-password" className="text-sm font-medium">
                        Confirm password
                      </label>
                      <Input
                        id="pdf-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        maxLength={128}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Enter the same password again"
                      />
                    </div>
                  )}
                </protectForm.Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses AES-256. The same password opens and manages the protected PDF. Save it
                somewhere safe; it cannot be recovered.
              </p>
              <Button type="submit" className="self-end" disabled={model.protect.isPending}>
                {model.protect.isPending ? "Protecting PDF…" : "Protect PDF"}
              </Button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void unlockForm.handleSubmit()
              }}
            >
              <unlockForm.Field name="password">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pdf-current-password" className="text-sm font-medium">
                      Current PDF password
                    </label>
                    <Input
                      id="pdf-current-password"
                      type="password"
                      autoComplete="current-password"
                      maxLength={128}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Enter the password used to open this PDF"
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p role="alert" className="text-sm text-error">
                        Enter a password up to 128 characters long.
                      </p>
                    )}
                  </div>
                )}
              </unlockForm.Field>
              <Button type="submit" className="self-end" disabled={model.unlock.isPending}>
                {model.unlock.isPending ? "Unlocking PDF…" : "Remove password protection"}
              </Button>
            </form>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {error}
            </p>
          )}

          {model.result && (
            <div className="rounded-xl bg-tertiary-container p-4 text-on-tertiary-container">
              <p className="font-medium">
                {model.result.operation === "protected" ? "PDF protected" : "PDF unlocked"}
              </p>
              <p className="mt-1 text-sm">
                {formatBytes(model.result.inputBytes)} → {formatBytes(model.result.outputBytes)}
              </p>
              {model.result.operation === "protected" && (
                <p className="mt-1 text-sm">Remember your password; it is not stored.</p>
              )}
              <Button
                className="mt-3"
                render={
                  <a
                    href={model.result.url}
                    download={model.result.fileName}
                    aria-label="Download PDF"
                  />
                }
                nativeButton={false}
              >
                <DownloadIcon />
                Download PDF
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
