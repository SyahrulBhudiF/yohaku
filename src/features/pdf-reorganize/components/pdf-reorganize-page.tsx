import { DownloadIcon, Loader2Icon, RotateCwIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { newPdfId } from "@/features/pdf-tools/store"
import { PasswordPrompt } from "@/features/pdf-tools/components/password-prompt"
import { PageGrid } from "@/features/pdf-tools/components/page-grid"
import { PdfDropzone } from "@/features/pdf-tools/components/pdf-dropzone"
import { preparePdfFile } from "@/features/pdf-tools/process"
import { disposePdfFile } from "@/features/pdf-tools/thumbnails"
import { isPdfFile } from "@/features/pdf-tools/validation"
import { usePdfReorganize } from "../use-pdf-reorganize"

interface PendingPassword {
  readonly id: string
  readonly file: File
  readonly message: string
}

export function PdfReorganizePage() {
  const model = usePdfReorganize()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [pending, setPending] = useState<PendingPassword | null>(null)
  const errorMessage = error ?? model.reorganize.error?.message ?? null

  const handleFiles = async (incoming: ReadonlyArray<File>) => {
    const file = incoming[0]

    if (!file) return

    model.clear()
    setError(null)

    if (pending) disposePdfFile(pending.id)
    setPending(null)

    if (!isPdfFile(file)) {
      setError("Choose a PDF file.")

      return
    }

    if (file.size === 0 || file.size > MAX_PDF_BYTES) {
      setError(
        file.size === 0
          ? "This PDF is empty."
          : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      )

      return
    }

    const id = newPdfId()

    setLoading(true)

    try {
      const prepared = await preparePdfFile(id, file)

      if (!prepared.ok) {
        if (prepared.reason === "password") {
          setPending({ id, file, message: prepared.message })
        } else {
          disposePdfFile(id)
          setError(prepared.message)
        }

        return
      }

      model.setFile({
        id,
        file,
        name: file.name,
        size: file.size,
        pageCount: prepared.pageCount,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (password: string) => {
    if (!pending) return

    setUnlocking(true)
    setError(null)

    try {
      const prepared = await preparePdfFile(pending.id, pending.file, password)

      if (!prepared.ok) {
        setPending({ ...pending, message: prepared.message })

        return
      }

      model.setFile({
        id: pending.id,
        file: pending.file,
        name: pending.file.name,
        size: pending.file.size,
        pageCount: prepared.pageCount,
        password,
      })
      setPending(null)
    } finally {
      setUnlocking(false)
    }
  }

  const clear = () => {
    model.clear()
    setError(null)

    if (pending) disposePdfFile(pending.id)
    setPending(null)
  }

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
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">Reorganize PDF pages</h1>
        <p className="text-muted-foreground">
          Drag pages to reorder them, rotate individual pages, or remove pages. Everything runs in
          your browser.
        </p>
      </div>

      {!model.file && !pending && (
        <PdfDropzone
          disabled={loading}
          onFiles={(files) => void handleFiles(files)}
          hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
          label={loading ? "Reading PDF…" : undefined}
        />
      )}

      {pending && (
        <PasswordPrompt
          name={pending.file.name}
          size={pending.file.size}
          message={pending.message}
          busy={unlocking}
          onUnlock={(password) => void handleUnlock(password)}
          onRemove={clear}
        />
      )}

      {model.file && (
        <>
          <Card size="sm">
            <CardContent className="flex items-center gap-4 p-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <RotateCwIcon />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{model.file.name}</span>
                <span className="text-sm text-muted-foreground">
                  {model.file.pageCount} {model.file.pageCount === 1 ? "page" : "pages"} ·{" "}
                  {formatBytes(model.file.size)}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={clear} aria-label="Remove PDF">
                <XIcon />
              </Button>
            </CardContent>
          </Card>

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

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {errorMessage}
            </p>
          )}

          <Button
            className="self-end"
            disabled={model.reorganize.isPending || model.pages.length === 0}
            onClick={handleReorganize}
          >
            {model.reorganize.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {model.reorganize.isPending ? "Saving pages…" : "Save reorganized PDF"}
          </Button>

          {model.result && (
            <div className="rounded-xl bg-tertiary-container p-4 text-on-tertiary-container">
              <p className="font-medium">Your PDF is ready</p>
              <p className="mt-1 text-sm">
                {formatBytes(model.result.inputBytes)} → {formatBytes(model.result.bytes)} ·{" "}
                {model.result.pages} {model.result.pages === 1 ? "page" : "pages"}
              </p>
              <Button
                className="mt-3"
                render={
                  <a
                    href={model.result.url}
                    download={model.result.fileName}
                    aria-label="Download reorganized PDF"
                  />
                }
                nativeButton={false}
              >
                <DownloadIcon />
                Download reorganized PDF
              </Button>
            </div>
          )}
        </>
      )}

      {!model.file && !pending && error && (
        <p role="alert" className="text-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  )
}
