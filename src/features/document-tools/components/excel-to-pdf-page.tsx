import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { DownloadIcon, FileSpreadsheetIcon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  ExcelPdfFormSchema,
  MAX_EXCEL_BYTES,
  type ExcelOrientation,
  type ExcelPageSize,
  type ExcelPdfFormValues,
} from "@/libs/schemas/excel"
import { formatBytes } from "@/libs/utils/format"
import { preloadXlsxPdf } from "@/libs/utils/xlsx-pdf"
import { processExcelToPdf } from "../process"
import { useExcelToPdfStore } from "../store"
import { isExcelFile } from "../validation"
import { ExcelDropzone } from "./excel-dropzone"

const PAGE_SIZE_LABEL: Record<ExcelPageSize, string> = {
  a4: "A4",
  letter: "Letter",
}

const ORIENTATION_LABEL: Record<ExcelOrientation, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
}

export function ExcelToPdfPage() {
  const { file, result, setFile, setResult, clearResult, reset } = useExcelToPdfStore()
  const convert = useMutation({ mutationFn: processExcelToPdf, onSuccess: setResult })
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      pageSize: "a4",
      orientation: "landscape",
    } as ExcelPdfFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(ExcelPdfFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        convert.reset()
        setError(null)
      },
    },
    onSubmit: async ({ value }) => {
      if (!file) {
        return
      }

      setError(null)
      await convert
        .mutateAsync({
          file,
          pageSize: value.pageSize,
          orientation: value.orientation,
        })
        .catch(() => null)
    },
  })
  const errorMessage = error ?? convert.error?.message ?? null

  useEffect(() => {
    void preloadXlsxPdf().catch(() => null)
  }, [])

  const handleFile = (incoming: ReadonlyArray<File>) => {
    const next = incoming[0]

    if (!next) {
      return
    }

    convert.reset()
    setError(null)

    if (!isExcelFile(next)) {
      setError("Choose an .xlsx or .xlsm workbook.")

      return
    }

    if (next.size > MAX_EXCEL_BYTES) {
      setError(`Workbooks can be at most ${MAX_EXCEL_BYTES / 1024 / 1024} MB.`)

      return
    }

    setFile(next)
  }

  const handleRemove = () => {
    convert.reset()
    setError(null)
    reset()
  }

  const handleReset = () => {
    convert.reset()
    setError(null)
    form.reset()
    reset()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="excel-to-pdf" japanese="ExcelからPDFへ">
        <h1 className="text-3xl font-normal tracking-tight">Excel to PDF</h1>
        <p className="text-muted-foreground">
          Turn every sheet into a clean, printable PDF table. The first row becomes the header and
          repeats on each page. Everything runs in your browser.
        </p>
      </ToolPageHeader>

      {file === null ? (
        <ExcelDropzone
          disabled={convert.isPending}
          onFiles={handleFile}
          hint={`XLSX or XLSM · up to ${MAX_EXCEL_BYTES / 1024 / 1024} MB`}
        />
      ) : (
        <ExcelDropzone
          compact
          disabled={convert.isPending}
          onFiles={handleFile}
          label="Replace workbook"
          hint="Drop another .xlsx or .xlsm file"
        />
      )}

      {errorMessage && file === null && (
        <p
          role="alert"
          className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {errorMessage}
        </p>
      )}

      {file && (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <FileSpreadsheetIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-base">{file.name}</CardTitle>
                <CardDescription>{formatBytes(file.size)}</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleRemove}
                disabled={convert.isPending}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form
              id="excel-to-pdf-form"
              className="flex flex-col gap-6"
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <form.Field name="pageSize">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Page size</span>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as ExcelPageSize)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>{PAGE_SIZE_LABEL[field.state.value]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a4">A4</SelectItem>
                          <SelectItem value="letter">Letter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <form.Field name="orientation">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Orientation</span>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as ExcelOrientation)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>{ORIENTATION_LABEL[field.state.value]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="landscape">Landscape</SelectItem>
                          <SelectItem value="portrait">Portrait</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm">
                <FileSpreadsheetIcon className="size-4" />
                <span className="font-medium">All sheets</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  First row repeats as the header
                </span>
              </div>
            </form>

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
                  <CardTitle className="text-base">PDF ready</CardTitle>
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
          </CardContent>
        </Card>
      )}

      {file && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={handleReset} disabled={convert.isPending}>
            <Trash2Icon /> Clear
          </Button>
          <Button
            type="button"
            onClick={() => void form.handleSubmit()}
            disabled={convert.isPending}
          >
            {convert.isPending && <Loader2Icon className="animate-spin" />}
            {convert.isPending ? "Converting…" : "Convert to PDF"}
          </Button>
        </div>
      )}
    </div>
  )
}
