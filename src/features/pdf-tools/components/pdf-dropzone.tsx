import { FileUpIcon } from "lucide-react"
import { useRef, useState } from "react"

import { cn } from "@/libs/utils/cn"

interface PdfDropzoneProps {
  readonly onFiles: (files: Array<File>) => void
  readonly multiple?: boolean
  readonly compact?: boolean
  readonly disabled?: boolean
  readonly label?: string | undefined
  readonly hint?: string | undefined
}

export function PdfDropzone({
  onFiles,
  multiple = false,
  compact = false,
  disabled = false,
  label,
  hint,
}: PdfDropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    if (multiple) {
      onFiles([...files])

      return
    }

    const first = files[0]

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
        <FileUpIcon className={compact ? "size-5" : "size-6"} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {label ??
            (multiple
              ? "Drop PDFs here, or click to browse"
              : "Drop a PDF here, or click to browse")}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        hidden
        onChange={(event) => {
          accept(event.target.files)
          event.target.value = ""
        }}
      />
    </button>
  )
}
