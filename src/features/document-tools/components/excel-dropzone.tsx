import { FileSpreadsheetIcon } from "lucide-react"
import { useRef, useState } from "react"

import { MAX_EXCEL_BYTES } from "@/libs/schemas/excel"
import { cn } from "@/libs/utils/cn"

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
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (files: FileList | null) => {
    const first = files?.[0]

    if (first) {
      onFiles([first])
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => input.current?.click()}
      onDragOver={(event) => {
        event.preventDefault()

        if (!disabled) {
          setDragging(true)
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)

        if (!disabled) {
          accept(event.dataTransfer.files)
        }
      }}
      className={cn(
        "flex w-full items-center rounded-xl border-2 border-dashed border-outline bg-surface-container-low text-left transition-colors outline-none hover:bg-surface-container focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "gap-3 px-4 py-3" : "flex-col gap-3 px-6 py-16 text-center",
        dragging && "border-primary bg-primary-container",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-primary-container text-on-primary-container",
          compact ? "size-10" : "size-14",
        )}
      >
        <FileSpreadsheetIcon className={compact ? "size-5" : "size-6"} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {label ?? "Drop an Excel workbook here, or click to browse"}
        </span>
        <span className="text-sm text-muted-foreground">
          {hint ?? `XLSX or XLSM · up to ${MAX_EXCEL_BYTES / 1024 / 1024} MB`}
        </span>
      </span>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
        hidden
        onChange={(event) => {
          accept(event.target.files)
          event.target.value = ""
        }}
      />
    </button>
  )
}
