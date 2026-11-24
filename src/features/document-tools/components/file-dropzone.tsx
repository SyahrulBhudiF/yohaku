import type { LucideIcon } from "lucide-react"
import { XIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatBytes } from "@/libs/utils/format"

interface FileDropzoneProps {
  readonly accept: string
  readonly file: File | null
  readonly icon: LucideIcon
  readonly helperText: string
  readonly onSelect: (file: File | undefined) => void
  readonly onRemove: () => void
}

export function FileDropzone({
  accept,
  file,
  icon: Icon,
  helperText,
  onSelect,
  onRemove,
}: FileDropzoneProps) {
  const input = useRef<HTMLInputElement>(null)

  if (file) {
    return (
      <Card size="sm">
        <CardContent className="flex items-center gap-4 p-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
            <Icon aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-medium">{file.name}</span>
            <span className="text-sm text-muted-foreground">{formatBytes(file.size)}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove file">
            <XIcon aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          onSelect(event.dataTransfer.files[0])
        }}
        className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-outline bg-surface-container-low p-8 text-center transition-colors hover:bg-surface-container focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <span className="font-medium">Drop a file here, or click to browse</span>
        <span className="text-xs text-muted-foreground">{helperText}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          onSelect(event.target.files?.[0])
          event.target.value = ""
        }}
      />
    </div>
  )
}
