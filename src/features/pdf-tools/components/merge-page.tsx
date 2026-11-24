import { useMutation } from "@tanstack/react-query"
import { FilesIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { InlineError } from "@/features/tools/components/inline-error"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_PDF_BYTES,
  MAX_PDF_FILES,
  MAX_PDF_PAGES,
  MAX_PDF_TOTAL_BYTES,
} from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { mergePdfPages, preparePdfBatch, preparePdfFile } from "../process"
import { useMergeStore, type PdfPageEntry } from "../store"
import { disposePdfFile } from "../thumbnails"
import { isPdfBatchWithinSizeLimit } from "../validation"
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
  const merge = useMutation({
    mutationFn: mergePdfPages,
    onSuccess: (output, input) => {
      if (useMergeStore.getState().pages === input.pages) {
        setResult(output)
      }
    },
  })
  const addFilesMutation = useMutation({ mutationFn: preparePdfBatch })
  const unlockMutation = useMutation({
    mutationFn: ({
      id,
      file,
      password,
    }: {
      readonly id: string
      readonly file: File
      readonly password: string
    }) => preparePdfFile(id, file, password),
  })
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [pending, setPending] = useState<Array<PendingPassword>>([])
  const inputBytes = files.reduce((total, file) => total + file.size, 0)
  const errorMessage =
    error ??
    addFilesMutation.error?.message ??
    unlockMutation.error?.message ??
    merge.error?.message ??
    null

  const resetMutation = () => {
    merge.reset()
    setError(null)
  }

  const handleFiles = (incoming: Array<File>) => {
    resetMutation()
    addFilesMutation.mutate(
      {
        files: incoming,
        existingFileCount: files.length,
        existingTotalBytes: inputBytes,
        existingPageCount: pages.length,
      },
      {
        onSuccess: (batch) => {
          if (batch.accepted.length > 0) {
            addFiles(batch.accepted)
          }

          if (batch.pending.length > 0) {
            setPending((current) => [...current, ...batch.pending])
          }

          if (batch.errors.length > 0) {
            const message = batch.errors[0] ?? null

            setError(message)
          }
        },
      },
    )
  }

  const handleUnlock = (entry: PendingPassword, password: string) => {
    resetMutation()
    setUnlocking(entry.id)
    unlockMutation.mutate(
      { id: entry.id, file: entry.file, password },
      {
        onSuccess: (prepared) => {
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
            setPending((items) => items.filter((item) => item.id !== entry.id))

            return
          }

          if (!isPdfBatchWithinSizeLimit(totalBytes, entry.file.size)) {
            disposePdfFile(entry.id)
            setError(`The combined PDFs can be at most ${MAX_PDF_TOTAL_BYTES / 1024 / 1024} MB.`)
            setPending((items) => items.filter((item) => item.id !== entry.id))

            return
          }

          if (current.pages.length + prepared.pageCount > MAX_PDF_PAGES) {
            disposePdfFile(entry.id)
            setError(`A merge can contain at most ${MAX_PDF_PAGES.toLocaleString()} pages.`)
            setPending((items) => items.filter((item) => item.id !== entry.id))

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
          setPending((items) => items.filter((item) => item.id !== entry.id))
        },
        onSettled: () => setUnlocking(null),
      },
    )
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
    addFilesMutation.reset()
    unlockMutation.reset()
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
      <ToolPageHeader id="pdf-merge" japanese="PDFを結合">
        <h1 className="text-3xl font-normal tracking-tight">Merge PDF</h1>
        <p className="text-muted-foreground">
          Combine PDFs and drag pages into the order you want. Everything runs in your browser.
        </p>
      </ToolPageHeader>

      {pages.length === 0 && pending.length === 0 ? (
        <PdfDropzone
          multiple
          disabled={addFilesMutation.isPending}
          onFiles={handleFiles}
          hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB each · ${MAX_PDF_TOTAL_BYTES / 1024 / 1024} MB total`}
          label={addFilesMutation.isPending ? "Reading PDFs…" : undefined}
        />
      ) : (
        <PdfDropzone
          multiple
          compact
          disabled={addFilesMutation.isPending}
          onFiles={handleFiles}
          label={addFilesMutation.isPending ? "Reading PDFs…" : "Add more PDFs"}
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
              onUnlock={(password) => handleUnlock(entry, password)}
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

      <InlineError>{errorMessage}</InlineError>

      {result && (
        <ConversionResult
          url={result.url}
          fileName={result.fileName}
          inputBytes={result.inputBytes}
          outputBytes={result.bytes}
          detail={`${result.pages} ${result.pages === 1 ? "page" : "pages"} merged`}
        />
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
