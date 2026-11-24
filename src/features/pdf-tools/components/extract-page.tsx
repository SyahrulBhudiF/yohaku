import { useMutation } from "@tanstack/react-query"
import { DownloadIcon, Loader2Icon, ScissorsIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { parsePageSelection } from "@/libs/utils/pdf/ranges"
import { extractPdfPages, preparePdfFile } from "../process"
import { newPdfId, usePdfExtractStore } from "../store"
import { disposePdfFile } from "../thumbnails"
import { isPdfFile } from "../validation"
import { PasswordPrompt } from "./password-prompt"
import { PdfDropzone } from "./pdf-dropzone"
import { PageThumbnail } from "./page-thumbnail"

interface PendingPassword {
  readonly id: string
  readonly file: File
  readonly message: string
}

export function ExtractPage() {
  const { file, result, setFile, setResult, reset } = usePdfExtractStore()
  const extract = useMutation({ mutationFn: extractPdfPages, onSuccess: setResult })
  const [selection, setSelection] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [pending, setPending] = useState<PendingPassword | null>(null)

  const handleFile = async (incoming: ReadonlyArray<File>) => {
    const next = incoming[0]

    if (!next) {
      return
    }

    reset()
    extract.reset()
    setSelection("")
    setError(null)
    setPending(null)

    if (pending) {
      disposePdfFile(pending.id)
    }

    if (!isPdfFile(next)) {
      setError("Only PDF files can be extracted.")

      return
    }

    if (next.size > MAX_PDF_BYTES) {
      setError(`PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`)

      return
    }

    setLoading(true)

    try {
      const id = newPdfId()
      const prepared = await preparePdfFile(id, next)

      if (!prepared.ok) {
        if (prepared.reason === "password") {
          setPending({ id, file: next, message: prepared.message })
        } else {
          disposePdfFile(id)
          setError(prepared.message)
        }

        return
      }

      setFile({ id, file: next, name: next.name, size: next.size, pageCount: prepared.pageCount })
      setSelection(prepared.pageCount === 1 ? "1" : `1-${prepared.pageCount}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (password: string) => {
    if (!pending) {
      return
    }

    setUnlocking(true)
    setError(null)

    try {
      const prepared = await preparePdfFile(pending.id, pending.file, password)

      if (!prepared.ok) {
        setPending({ ...pending, message: prepared.message })

        return
      }

      setFile({
        id: pending.id,
        file: pending.file,
        name: pending.file.name,
        size: pending.file.size,
        pageCount: prepared.pageCount,
        password,
      })
      setPending(null)
      setSelection(prepared.pageCount === 1 ? "1" : `1-${prepared.pageCount}`)
    } finally {
      setUnlocking(false)
    }
  }

  const handleReset = () => {
    extract.reset()
    reset()

    if (pending) {
      disposePdfFile(pending.id)
    }

    setPending(null)
    setSelection("")
    setError(null)
  }

  const parsed = file ? parsePageSelection(selection, file.pageCount) : null
  const errorMessage =
    error ?? extract.error?.message ?? (parsed && !parsed.ok ? parsed.message : null)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-extract" japanese="PDFのページを抽出">
        <h1 className="text-3xl font-normal tracking-tight">Extract PDF pages</h1>
        <p className="text-muted-foreground">
          Choose pages to keep and download them as a new PDF. Your file stays in this browser.
        </p>
      </ToolPageHeader>
      {!file && !pending && (
        <PdfDropzone
          disabled={loading}
          onFiles={(files) => void handleFile(files)}
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
          onRemove={() => {
            disposePdfFile(pending.id)
            setPending(null)
          }}
        />
      )}
      {file && (
        <>
          <Card size="sm">
            <CardContent className="flex items-center gap-4 pt-4">
              <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-outline-variant">
                <PageThumbnail
                  fileId={file.id}
                  file={file.file}
                  pageNumber={1}
                  password={file.password}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{file.name}</span>
                <span className="text-sm text-muted-foreground">
                  {file.pageCount} {file.pageCount === 1 ? "page" : "pages"} ·{" "}
                  {formatBytes(file.size)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                aria-label={`Remove ${file.name}`}
              >
                <XIcon />
              </Button>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-2">
            <label htmlFor="extract-pages" className="text-sm font-medium">
              Pages to keep
            </label>
            <Input
              id="extract-pages"
              value={selection}
              onChange={(event) => {
                setSelection(event.target.value)
                extract.reset()
                setError(null)
              }}
              placeholder={`e.g. 1-3, 5, 8-${file.pageCount}`}
              aria-describedby="extract-help"
            />
            <p id="extract-help" className="text-xs text-muted-foreground">
              Enter page numbers and ranges separated by commas. Pages are kept in ascending order;
              overlapping ranges are ignored.
            </p>
          </div>
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
                <CardTitle className="text-base">Extracted PDF ready</CardTitle>
                <CardDescription className="text-on-tertiary-container/80">
                  {formatBytes(result.inputBytes)} → {formatBytes(result.bytes)} · {result.pages}{" "}
                  {result.pages === 1 ? "page" : "pages"}
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
                >
                  <DownloadIcon /> Download {result.fileName}
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (!parsed?.ok || parsed.pages.length === 0) {
                  setError(
                    parsed?.ok
                      ? "Choose at least one page."
                      : (parsed?.message ?? "Enter pages to extract."),
                  )

                  return
                }

                setError(null)
                void extract.mutateAsync({ file, pages: parsed.pages }).catch(() => null)
              }}
              disabled={extract.isPending || !selection.trim()}
            >
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
        </>
      )}
    </div>
  )
}
