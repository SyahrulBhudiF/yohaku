import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { Loader2Icon, PlusIcon, ScissorsIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { InlineError } from "@/features/tools/components/inline-error"
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
  type PdfSplitRange,
} from "@/libs/schemas/pdf"
import { validatePageRanges, type PageRangesResult } from "@/libs/utils/pdf/ranges"
import { splitPdf } from "../process"
import { newPdfId, useSplitStore } from "../store"
import { usePdfFile } from "../use-pdf-file"
import { PasswordPrompt } from "./password-prompt"
import { PdfDropzone } from "./pdf-dropzone"
import { PdfFileCard } from "./pdf-file-card"

const SPLIT_MODE_LABEL: Record<PdfSplitMode, string> = {
  every: "Every page",
  chunks: "Every N pages",
  ranges: "Custom ranges",
}

const buildRanges = (rows: ReadonlyArray<PdfSplitRange>, pageCount: number): PageRangesResult => {
  const ranges: Array<PdfPageRange> = rows.map((row) => ({
    start: Number(row.start),
    end: Number(row.end),
  }))

  return validatePageRanges(ranges, pageCount)
}

export function SplitPage() {
  const { file, result, setFile, setResult, clearResult, reset } = useSplitStore()
  const split = useMutation({
    mutationFn: splitPdf,
    onSuccess: setResult,
  })
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      mode: "every",
      pagesPerFile: 1,
      ranges: [],
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
        const checked = buildRanges(value.ranges, file.pageCount)

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
  const pdf = usePdfFile({
    setFile,
    reset,
    invalidMessage: "Only PDF files can be split.",
    onReset: () => {
      form.reset()
      setError(null)
    },
    onSelected: (entry) => {
      form.setFieldValue("ranges", [{ id: newPdfId(), start: "1", end: String(entry.pageCount) }])
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
        : values.ranges.length
    : 0
  const errorMessage = error ?? pdf.error ?? split.error?.message ?? null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-split" japanese="PDFを分割">
        <h1 className="text-3xl font-normal tracking-tight">Split PDF</h1>
        <p className="text-muted-foreground">
          Split a PDF by page ranges. Multiple results download together as a ZIP.
        </p>
      </ToolPageHeader>

      {!file && !pdf.pending && (
        <PdfDropzone
          disabled={pdf.isReading}
          onFiles={(incoming) => void pdf.select(incoming)}
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
          <PdfFileCard file={file} onRemove={pdf.remove} disabled={split.isPending} />

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
                    onValueChange={(value) => field.handleChange(value as PdfSplitMode)}
                  >
                    <SelectTrigger className="w-full" aria-label="Split mode">
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
              <form.Field name="ranges">
                {(field) => {
                  const rows = field.state.value
                  const last = rows.at(-1)
                  const lastEnd = last ? Number(last.end) : 0
                  const nextStart =
                    Number.isInteger(lastEnd) && lastEnd >= 1
                      ? Math.min(file.pageCount, lastEnd + 1)
                      : 1

                  return (
                    <div className="flex flex-col gap-3">
                      <span className="text-sm font-medium">Page ranges</span>
                      {rows.map((row, index) => (
                        <div key={row.id} className="flex items-end gap-2">
                          <span className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                            From
                            <Input
                              type="number"
                              min={1}
                              max={file.pageCount}
                              value={row.start}
                              aria-label={`Range ${index + 1} start page`}
                              onChange={(event) =>
                                field.handleChange(
                                  rows.map((entry) =>
                                    entry.id === row.id
                                      ? { ...entry, start: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
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
                              onChange={(event) =>
                                field.handleChange(
                                  rows.map((entry) =>
                                    entry.id === row.id
                                      ? { ...entry, end: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              field.handleChange(rows.filter((entry) => entry.id !== row.id))
                            }
                            aria-label={`Remove range ${index + 1}`}
                          >
                            <XIcon />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          field.handleChange([
                            ...rows,
                            {
                              id: newPdfId(),
                              start: String(nextStart),
                              end: String(file.pageCount),
                            },
                          ])
                        }
                      >
                        <PlusIcon /> Add range
                      </Button>
                    </div>
                  )
                }}
              </form.Field>
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

          <InlineError>{errorMessage}</InlineError>

          {result && (
            <ConversionResult
              url={result.url}
              fileName={result.fileName}
              inputBytes={result.inputBytes}
              outputBytes={result.bytes}
              detail={`${result.outputs ?? 1} ${(result.outputs ?? 1) === 1 ? "PDF" : "PDFs"}`}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={pdf.remove} disabled={split.isPending}>
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
