import { useForm } from "@tanstack/react-form"
import { Schema } from "effect"
import { FileSpreadsheetIcon, TablePropertiesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  CSV_EXCEL_MODES,
  CsvExcelFormSchema,
  MAX_CSV_EXCEL_BYTES,
  type CsvExcelFormValues,
  type CsvExcelMode,
} from "@/libs/schemas/csv-excel"
import { useCsvExcel } from "../use-csv-excel"

const MODE_LABEL: Record<CsvExcelMode, string> = {
  "csv-to-excel": "CSV to Excel",
  "excel-to-csv": "Excel to CSV",
}

const MODE_ACCEPT: Record<CsvExcelMode, string> = {
  "csv-to-excel": ".csv,text/csv",
  "excel-to-csv":
    ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
}

export function CsvExcelPage() {
  const form = useForm({
    defaultValues: { mode: "csv-to-excel", sheet: "" } as CsvExcelFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(CsvExcelFormSchema) },
    onSubmit: ({ value }) => {
      if (!model.file) return

      model.convert.mutate({
        file: model.file,
        mode: value.mode,
        ...(value.sheet ? { sheet: value.sheet } : {}),
      })
    },
  })
  const model = useCsvExcel(form.state.values.mode)
  const error = model.selectionError ?? model.convert.error?.message ?? model.sheetsError
  const mode = form.state.values.mode

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="csv-excel" japanese="CSVとExcelの変換">
        <h1 className="text-3xl font-normal tracking-tight">CSV ↔ Excel</h1>
        <p className="text-muted-foreground">
          Convert a CSV into an Excel workbook, or export one worksheet as CSV. Everything stays in
          your browser.
        </p>
      </ToolPageHeader>

      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="mode">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor="csv-excel-mode" className="text-sm font-medium">
                Direction
              </label>
              <select
                id="csv-excel-mode"
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value as CsvExcelMode)
                  form.setFieldValue("sheet", "")
                  model.clear()
                }}
                className="h-12 rounded-xl border border-outline-variant bg-surface px-4 text-sm"
              >
                {CSV_EXCEL_MODES.map((value) => (
                  <option key={value} value={value}>
                    {MODE_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Field>

        <FileDropzone
          accept={MODE_ACCEPT[mode]}
          file={model.file}
          icon={FileSpreadsheetIcon}
          helperText={`${mode === "csv-to-excel" ? "CSV" : "XLSX or XLS"} only · up to ${MAX_CSV_EXCEL_BYTES / 1024 / 1024} MB`}
          onSelect={(file) => {
            model.selectFile(file)
            form.setFieldValue("sheet", "")
          }}
          onRemove={model.clear}
        />

        {mode === "excel-to-csv" && model.file && (
          <form.Field name="sheet">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="csv-excel-sheet" className="text-sm font-medium">
                  Worksheet
                </label>
                <select
                  id="csv-excel-sheet"
                  value={field.state.value}
                  disabled={model.sheetsPending}
                  onChange={(event) => {
                    field.handleChange(event.target.value)
                    model.convert.reset()
                    model.clearResult()
                  }}
                  className="h-12 rounded-xl border border-outline-variant bg-surface px-4 text-sm disabled:opacity-50"
                >
                  <option value="">First sheet (default)</option>
                  {model.sheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
                {model.sheetsPending && (
                  <p className="text-xs text-muted-foreground">Reading worksheets…</p>
                )}
                {model.sheetsError && (
                  <p role="alert" className="text-sm text-error">
                    {model.sheetsError}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        )}

        <p className="text-sm text-muted-foreground">
          {mode === "csv-to-excel"
            ? "The first CSV row is used as the header row. The workbook is created locally."
            : "The selected worksheet is exported as UTF-8 CSV with a BOM so Excel opens it correctly."}
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
          >
            {error}
          </p>
        )}

        {model.file && !model.result && (
          <Button
            type="submit"
            className="self-end"
            disabled={model.convert.isPending}
            aria-busy={model.convert.isPending}
          >
            <TablePropertiesIcon />
            {model.convert.isPending ? "Converting…" : "Convert"}
          </Button>
        )}
      </form>

      {model.result && (
        <ConversionResult
          url={model.result.url}
          fileName={model.result.fileName}
          inputBytes={model.result.inputBytes}
          outputBytes={model.result.outputBytes}
          detail={
            model.result.sheet
              ? `worksheet ${model.result.sheet}`
              : `${model.result.sheets.length} ${model.result.sheets.length === 1 ? "worksheet" : "worksheets"}`
          }
        />
      )}
    </main>
  )
}
