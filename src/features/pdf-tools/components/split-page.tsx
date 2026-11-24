import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { DownloadIcon, Loader2Icon, PlusIcon, ScissorsIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MAX_PDF_BYTES,
  MAX_SPLIT_OUTPUTS,
  PdfSplitFormSchema,
  type PdfPageRange,
  type PdfSplitFormValues,
  type PdfSplitMode,
} from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { validatePageRanges, type PageRangesResult } from "@/libs/utils/pdf/ranges"
import { preparePdfFile, splitPdf } from "../process"
import { newPdfId, useSplitStore } from "../store"
import { disposePdfFile } from "../thumbnails"
import { isPdfFile } from "../validation"
import { PageThumbnail } from "./page-thumbnail"
import { PasswordPrompt } from "./password-prompt"
import { PdfDropzone } from "./pdf-dropzone"

interface RangeRow {
  readonly id: string
  readonly start: string
  readonly end: string
}

interface PendingPassword {
  readonly id: string
  readonly file: File
  readonly message: string
}

const SPLIT_MODE_LABEL: Record<PdfSplitMode, string> = {
  every: "Every page",
  chunks: "Every N pages",
  ranges: "Custom ranges",
}

const buildRanges = (rows: ReadonlyArray<RangeRow>, pageCount: number): PageRangesResult => {
  const ranges: Array<PdfPageRange> = rows.map((row) => ({
    start: Number(row.start),
    end: Number(row.end),
  }))

  return validatePageRanges(ranges, pageCount)
}

export function SplitPage() {
  const { file, result, setFile, setResult, clearResult, reset } = useSplitStore()
  const split = useMutation({ mutationFn: splitPdf, onSuccess: setResult })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [pending, setPending] = useState<PendingPassword | null>(null)
  const [ranges, setRanges] = useState<Array<RangeRow>>([])
  const form = useForm({
    defaultValues: {
      mode: "every",
      pagesPerFile: 1,
    } as PdfSplitFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(PdfSplitFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        split.reset()
        setError(null)
      },
    },
    onSubmit: async ({ value }) => {
      if (!file) {
        return
      }

      let pageRanges: ReadonlyArray<PdfPageRange> = []
      let outputCount =
        value.mode === "every"
          ? file.pageCount
          : Math.ceil(file.pageCount / Math.max(1, value.pagesPerFile))

      if (value.mode === "ranges") {
        const checked = buildRanges(ranges, file.pageCount)

        if (!checked.ok) {
          setError(checked.message)

          return
        }

        pageRanges = checked.ranges
        outputCount = checked.ranges.length
      }

      if (value.mode === "chunks" && value.pagesPerFile > file.pageCount) {
        setError(`Pages per file must be between 1 and ${file.pageCount}.`)

        return
      }

      if (
        value.mode === "chunks" &&
        (!Number.isInteger(value.pagesPerFile) || value.pagesPerFile < 1)
      ) {
        setError(`Pages per file must be between 1 and ${file.pageCount}.`)

        return
      }

      if (outputCount > MAX_SPLIT_OUTPUTS) {
        setError(`A split can create at most ${MAX_SPLIT_OUTPUTS} files.`)

        return
      }

      setError(null)
      await split
        .mutateAsync({
          file,
          mode: value.mode,
          pagesPerFile: value.pagesPerFile,
          ranges: pageRanges,
        })
        .catch(() => null)
    },
  })
  const values = form.state.values
  const pagesPerFile =
    Number.isFinite(values.pagesPerFile) && values.pagesPerFile >= 1
      ? Math.floor(values.pagesPerFile)
      : 1
  const outputCount = file
    ? values.mode === "every"
      ? file.pageCount
      : values.mode === "chunks"
        ? Math.ceil(file.pageCount / pagesPerFile)
        : ranges.length
    : 0
  const errorMessage = error ?? split.error?.message ?? null

  const handleFile = async (incoming: Array<File>) => {
    const nextFile = incoming[0]

    if (!nextFile) {
      return
    }

    setError(null)
    setPending(null)
    setRanges([])
    split.reset()
    reset()
    form.reset()

    if (pending) {
      disposePdfFile(pending.id)
    }

    if (!isPdfFile(nextFile)) {
      setError("Only PDF files can be split.")

      return
    }

    if (nextFile.size > MAX_PDF_BYTES) {
      setError(`PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`)

      return
    }

    setLoading(true)

    try {
      const id = newPdfId()
      const prepared = await preparePdfFile(id, nextFile)

      if (!prepared.ok) {
        if (prepared.reason === "password") {
          setPending({ id, file: nextFile, message: prepared.message })
        } else {
          disposePdfFile(id)
          setError(prepared.message)
        }

        return
      }

      setFile({
        id,
        file: nextFile,
        name: nextFile.name,
        size: nextFile.size,
        pageCount: prepared.pageCount,
      })
      setRanges([{ id: newPdfId(), start: "1", end: String(prepared.pageCount) }])
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
      setRanges([{ id: newPdfId(), start: "1", end: String(prepared.pageCount) }])
      setPending(null)
    } finally {
      setUnlocking(false)
    }
  }

  const handleRemovePending = () => {
    if (pending) {
      disposePdfFile(pending.id)
    }

    setPending(null)
  }

  const handleReset = () => {
    split.reset()
    setError(null)

    if (pending) {
      disposePdfFile(pending.id)
    }

    setPending(null)
    setRanges([])
    form.reset()
    reset()
  }

  const updateRange = (id: string, field: "start" | "end", value: string) => {
    clearResult()
    split.reset()
    setError(null)
    setRanges((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  const addRange = () => {
    const last = ranges.at(-1)
    const lastEnd = last ? Number(last.end) : 0
    const pageCount = file?.pageCount ?? 1
    const start = Number.isInteger(lastEnd) && lastEnd >= 1 ? Math.min(pageCount, lastEnd + 1) : 1

    clearResult()
    split.reset()
    setError(null)
    setRanges((current) => [
      ...current,
      { id: newPdfId(), start: String(start), end: String(pageCount) },
    ])
  }

  const removeRange = (id: string) => {
    clearResult()
    split.reset()
    setError(null)
    setRanges((current) => current.filter((row) => row.id !== id))
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-split" japanese="PDFを分割">
        <h1 className="text-3xl font-normal tracking-tight">Split PDF</h1>
        <p className="text-muted-foreground">
          Split a PDF by page ranges. Multiple results download together as a ZIP.
        </p>
      </ToolPageHeader>

      {!file && !pending && (
        <PdfDropzone
          disabled={loading}
          onFiles={(incoming) => void handleFile(incoming)}
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
          onRemove={handleRemovePending}
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
                {file.password && (
                  <span className="text-xs text-muted-foreground">Password protected</span>
                )}
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

          <form
            id="split-form"
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="mode">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Split mode</span>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      field.handleChange(value as PdfSplitMode)
                      clearResult()
                      split.reset()
                      setError(null)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{SPLIT_MODE_LABEL[field.state.value]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="every">Every page</SelectItem>
                      <SelectItem value="chunks">Every N pages</SelectItem>
                      <SelectItem value="ranges">Custom ranges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            {values.mode === "chunks" && (
              <form.Field name="pagesPerFile">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pages-per-file" className="text-sm font-medium">
                      Pages per file
                    </label>
                    <Input
                      id="pages-per-file"
                      type="number"
                      min={1}
                      max={file.pageCount}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(Number(event.target.value))}
                      className="w-40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Creates {Math.ceil(file.pageCount / pagesPerFile)}{" "}
                      {Math.ceil(file.pageCount / pagesPerFile) === 1 ? "PDF" : "PDFs"}.
                    </p>
                    {field.state.meta.errors.length > 0 && (
                      <p role="alert" className="text-sm text-error">
                        Pages per file must be between 1 and {file.pageCount}.
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            )}

            {values.mode === "ranges" && (
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium">Page ranges</span>
                {ranges.map((row, index) => (
                  <div key={row.id} className="flex items-end gap-2">
                    <span className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      From
                      <Input
                        type="number"
                        min={1}
                        max={file.pageCount}
                        value={row.start}
                        aria-label={`Range ${index + 1} start page`}
                        onChange={(event) => updateRange(row.id, "start", event.target.value)}
                      />
                    </span>
                    <span className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      To
                      <Input
                        type="number"
                        min={1}
                        max={file.pageCount}
                        value={row.end}
                        aria-label={`Range ${index + 1} end page`}
                        onChange={(event) => updateRange(row.id, "end", event.target.value)}
                      />
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRange(row.id)}
                      aria-label={`Remove range ${index + 1}`}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addRange}>
                  <PlusIcon /> Add range
                </Button>
              </div>
            )}
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <ScissorsIcon className="size-4" />
              {outputCount} {outputCount === 1 ? "PDF" : "PDFs"}
            </span>
            <span className="text-xs text-muted-foreground">
              {outputCount > 1 ? "Downloads as a ZIP" : "Downloads as a PDF"}
            </span>
          </div>

          {outputCount > 1 && (
            <p className="text-xs text-muted-foreground">
              Each output is a standalone PDF, so pages that share images can make the total larger.
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
                  {result.outputs ?? 1} {(result.outputs ?? 1) === 1 ? "PDF" : "PDFs"} ready
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

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleReset} disabled={split.isPending}>
              <XIcon /> Remove PDF
            </Button>
            <Button type="submit" form="split-form" disabled={split.isPending}>
              {split.isPending && <Loader2Icon className="animate-spin" />}
              {split.isPending
                ? "Splitting…"
                : `Split into ${outputCount} ${outputCount === 1 ? "PDF" : "PDFs"}`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
