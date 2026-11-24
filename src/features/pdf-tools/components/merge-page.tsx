import { useMutation } from "@tanstack/react-query"
import { DownloadIcon, FilesIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MAX_PDF_BYTES,
  MAX_PDF_FILES,
  MAX_PDF_PAGES,
  MAX_PDF_TOTAL_BYTES,
} from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { mergePdfPages, preparePdfFile } from "../process"
import { newPdfId, useMergeStore, type PdfFileEntry, type PdfPageEntry } from "../store"
import { disposePdfFile } from "../thumbnails"
import { isPdfBatchWithinSizeLimit, isPdfFile } from "../validation"
import { PageGrid } from "./page-grid"
import { PasswordPrompt } from "./password-prompt"
import { PdfDropzone } from "./pdf-dropzone"

interface PendingPassword {
  readonly id: string
  readonly file: File
  readonly message: string
}

export function MergePage() {
  const { files, pages, result, addFiles, removePage, setPages, setResult, reset } = useMergeStore()
  const merge = useMutation({ mutationFn: mergePdfPages, onSuccess: setResult })
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [pending, setPending] = useState<Array<PendingPassword>>([])
  const inputBytes = files.reduce((total, file) => total + file.size, 0)
  const errorMessage = error ?? merge.error?.message ?? null

  const resetMutation = () => {
    merge.reset()
    setError(null)
  }

  const handleFiles = async (incoming: Array<File>) => {
    resetMutation()
    setAdding(true)

    const accepted: Array<PdfFileEntry> = []
    let totalBytes = inputBytes
    let totalPages = pages.length

    try {
      for (const file of incoming) {
        if (files.length + accepted.length >= MAX_PDF_FILES) {
          setError(`You can merge at most ${MAX_PDF_FILES} PDFs at once.`)
          break
        }

        if (!isPdfFile(file)) {
          setError("Only PDF files can be merged.")
          continue
        }

        if (file.size > MAX_PDF_BYTES) {
          setError(`Each PDF can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`)
          continue
        }

        if (!isPdfBatchWithinSizeLimit(totalBytes, file.size)) {
          setError(`The combined PDFs can be at most ${MAX_PDF_TOTAL_BYTES / 1024 / 1024} MB.`)
          continue
        }

        const id = newPdfId()
        const prepared = await preparePdfFile(id, file)

        if (!prepared.ok) {
          if (prepared.reason === "password") {
            setPending((current) => [...current, { id, file, message: prepared.message }])
          } else {
            disposePdfFile(id)
            setError(prepared.message)
          }

          continue
        }

        if (totalPages + prepared.pageCount > MAX_PDF_PAGES) {
          disposePdfFile(id)
          setError(`A merge can contain at most ${MAX_PDF_PAGES.toLocaleString()} pages.`)
          continue
        }

        accepted.push({
          id,
          file,
          name: file.name,
          size: file.size,
          pageCount: prepared.pageCount,
        })
        totalBytes += file.size
        totalPages += prepared.pageCount
      }

      if (accepted.length > 0) {
        addFiles(accepted)
      }
    } finally {
      setAdding(false)
    }
  }

  const handleUnlock = async (entry: PendingPassword, password: string) => {
    resetMutation()
    setUnlocking(entry.id)

    try {
      const prepared = await preparePdfFile(entry.id, entry.file, password)

      if (!prepared.ok) {
        setPending((current) =>
          current.map((item) =>
            item.id === entry.id ? { ...item, message: prepared.message } : item,
          ),
        )

        return
      }

      const current = useMergeStore.getState()
      const totalBytes = current.files.reduce((total, file) => total + file.size, 0)

      if (current.files.length >= MAX_PDF_FILES) {
        disposePdfFile(entry.id)
        setError(`You can merge at most ${MAX_PDF_FILES} PDFs at once.`)
        setPending((pending) => pending.filter((item) => item.id !== entry.id))

        return
      }

      if (!isPdfBatchWithinSizeLimit(totalBytes, entry.file.size)) {
        disposePdfFile(entry.id)
        setError(`The combined PDFs can be at most ${MAX_PDF_TOTAL_BYTES / 1024 / 1024} MB.`)
        setPending((pending) => pending.filter((item) => item.id !== entry.id))

        return
      }

      if (current.pages.length + prepared.pageCount > MAX_PDF_PAGES) {
        disposePdfFile(entry.id)
        setError(`A merge can contain at most ${MAX_PDF_PAGES.toLocaleString()} pages.`)
        setPending((pending) => pending.filter((item) => item.id !== entry.id))

        return
      }

      addFiles([
        {
          id: entry.id,
          file: entry.file,
          name: entry.file.name,
          size: entry.file.size,
          pageCount: prepared.pageCount,
          password,
        },
      ])
      setPending((current) => current.filter((item) => item.id !== entry.id))
    } finally {
      setUnlocking(null)
    }
  }

  const handleReorder = (nextPages: ReadonlyArray<PdfPageEntry>) => {
    resetMutation()
    setPages(nextPages)
  }

  const handleRemovePage = (pageId: string) => {
    resetMutation()
    removePage(pageId)
  }

  const handleRemovePending = (id: string) => {
    disposePdfFile(id)
    setPending((current) => current.filter((item) => item.id !== id))
  }

  const handleReset = () => {
    merge.reset()
    setError(null)

    for (const entry of pending) {
      disposePdfFile(entry.id)
    }

    setPending([])
    setUnlocking(null)
    reset()
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">Merge PDF</h1>
        <p className="text-muted-foreground">
          Combine PDFs and drag pages into the order you want. Everything runs in your browser.
        </p>
      </div>

      {pages.length === 0 && pending.length === 0 ? (
        <PdfDropzone
          multiple
          disabled={adding}
          onFiles={(incoming) => void handleFiles(incoming)}
          hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB each · ${MAX_PDF_TOTAL_BYTES / 1024 / 1024} MB total`}
          label={adding ? "Reading PDFs…" : undefined}
        />
      ) : (
        <PdfDropzone
          multiple
          compact
          disabled={adding}
          onFiles={(incoming) => void handleFiles(incoming)}
          label={adding ? "Reading PDFs…" : "Add more PDFs"}
          hint="Drag pages from any file into the order you want."
        />
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          {pending.map((entry) => (
            <PasswordPrompt
              key={entry.id}
              name={entry.file.name}
              size={entry.file.size}
              message={entry.message}
              busy={unlocking === entry.id}
              onUnlock={(password) => void handleUnlock(entry, password)}
              onRemove={() => handleRemovePending(entry.id)}
            />
          ))}
        </div>
      )}

      {pages.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <FilesIcon className="size-4" />
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </span>
          <span className="text-muted-foreground">
            {files.length} {files.length === 1 ? "PDF" : "PDFs"} · {formatBytes(inputBytes)}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Drag the handle on a page to reorder it.
          </span>
        </div>
      )}

      {pages.length > 0 && (
        <PageGrid
          pages={pages}
          files={files}
          onReorder={handleReorder}
          onRemove={handleRemovePage}
        />
      )}

      {pages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Page order is preserved exactly. Bookmarks, form fields, and attachments from the source
          files are not carried over.
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {errorMessage}
        </p>
      )}

      {result && (
        <Card size="sm" className="bg-tertiary-container text-on-tertiary-container">
          <CardHeader>
            <CardTitle className="text-base">
              {result.pages} {result.pages === 1 ? "page" : "pages"} merged
            </CardTitle>
            <CardDescription className="text-on-tertiary-container/80">
              {formatBytes(result.inputBytes)} → {formatBytes(result.bytes)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              render={
                <a
                  href={result.url}
                  download={result.fileName}
                  aria-label={`Download ${result.fileName}`}
                />
              }
              nativeButton={false}
              className="self-start"
            >
              <DownloadIcon /> Download {result.fileName}
            </Button>
          </CardContent>
        </Card>
      )}

      {pages.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={handleReset} disabled={merge.isPending}>
            <Trash2Icon /> Clear all
          </Button>
          <Button
            onClick={() => void merge.mutateAsync({ files, pages }).catch(() => null)}
            disabled={merge.isPending}
          >
            {merge.isPending && <Loader2Icon className="animate-spin" />}
            {merge.isPending
              ? "Merging…"
              : `Merge ${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
          </Button>
        </div>
      )}
    </div>
  )
}
