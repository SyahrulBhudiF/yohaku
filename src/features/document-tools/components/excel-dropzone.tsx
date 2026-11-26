import { FileSpreadsheetIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { MAX_EXCEL_BYTES } from "@/libs/schemas/excel"

interface ExcelDropzoneProps {
  readonly onFiles: (files: ReadonlyArray<File>) => void
  readonly compact?: boolean
  readonly disabled?: boolean
  readonly label?: string
  readonly hint?: string
}

export function ExcelDropzone({
  onFiles,
  compact = false,
  disabled = false,
  label,
  hint,
}: ExcelDropzoneProps) {
  return (
    <Dropzone
      icon={FileSpreadsheetIcon}
      accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
      compact={compact}
      disabled={disabled}
      label={label ?? "Drop an Excel workbook here, or click to browse"}
      hint={hint ?? `XLSX or XLSM · up to ${MAX_EXCEL_BYTES / 1024 / 1024} MB`}
      onFiles={onFiles}
    />
  )
}
