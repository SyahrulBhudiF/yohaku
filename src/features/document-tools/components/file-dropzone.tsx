import type { LucideIcon } from "lucide-react"
import { XIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
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
    <Dropzone
      icon={Icon}
      accept={accept}
      label="Drop a file here, or click to browse"
      hint={helperText}
      onFiles={(files) => onSelect(files[0])}
    />
  )
}
