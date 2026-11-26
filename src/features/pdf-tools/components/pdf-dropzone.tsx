import { FileUpIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"

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
  return (
    <Dropzone
      icon={FileUpIcon}
      accept="application/pdf,.pdf"
      multiple={multiple}
      compact={compact}
      disabled={disabled}
      label={
        label ??
        (multiple ? "Drop PDFs here, or click to browse" : "Drop a PDF here, or click to browse")
      }
      hint={hint ?? `PDF · up to ${MAX_PDF_BYTES / 1024 / 1024} MB${multiple ? " each" : ""}`}
      onFiles={(files) => onFiles([...files])}
    />
  )
}
