import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatBytes } from "@/libs/utils/format"
import { PageThumbnail } from "./page-thumbnail"
import type { PdfFileEntry } from "../store"

interface PdfFileCardProps {
  readonly file: PdfFileEntry
  readonly onRemove: () => void
  readonly disabled?: boolean
}

/** The selected PDF card shared by single-file PDF tools. */
export function PdfFileCard({ file, onRemove, disabled = false }: PdfFileCardProps) {
  return (
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
            {file.pageCount} {file.pageCount === 1 ? "page" : "pages"} · {formatBytes(file.size)}
          </span>
          {file.password && (
            <span className="text-xs text-muted-foreground">Password protected</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
        >
          <XIcon />
        </Button>
      </CardContent>
    </Card>
  )
}
