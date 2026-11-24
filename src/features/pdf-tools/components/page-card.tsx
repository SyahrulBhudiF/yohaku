import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FileTextIcon, GripVerticalIcon, RotateCwIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/libs/utils/cn"
import type { PdfFileEntry, PdfPageEntry } from "../store"
import { PageThumbnail } from "./page-thumbnail"

interface PageCardProps {
  readonly page: PdfPageEntry
  readonly file: PdfFileEntry
  readonly index: number
  readonly onRemove: (pageId: string) => void
  readonly onRotate?: (pageId: string) => void
  readonly canRemove?: boolean
}

export function PageCard({
  page,
  file,
  index,
  onRemove,
  onRotate,
  canRemove = true,
}: PageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    data: { type: "page" },
    attributes: { roleDescription: `Page ${page.pageNumber}` },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface-container-lowest ring-1 ring-outline-variant transition-shadow",
        isDragging ? "opacity-40 ring-2 ring-primary" : "hover:shadow-elevation-1",
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground tabular-nums">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={file.name}>
          {file.name}
        </span>
        {onRotate && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onRotate(page.id)}
            aria-label={`Rotate page ${page.pageNumber} 90 degrees clockwise`}
            className="size-7 shrink-0 text-on-surface-variant"
          >
            <RotateCwIcon />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          {...attributes}
          {...listeners}
          aria-label={`Drag page ${page.pageNumber} from ${file.name}`}
          className="shrink-0 cursor-grab touch-none text-on-surface-variant active:cursor-grabbing"
        >
          <GripVerticalIcon />
        </Button>
      </div>
      <div className="relative aspect-[210/297] bg-white">
        <PageThumbnail
          fileId={file.id}
          file={file.file}
          pageNumber={page.pageNumber}
          password={file.password}
          rotation={page.rotation ?? 0}
        />
      </div>
      <div className="flex items-center gap-1.5 border-t border-outline-variant px-2 py-1 text-xs text-muted-foreground">
        <FileTextIcon className="size-3 shrink-0" />
        <span className="min-w-0 truncate tabular-nums">
          Page {page.pageNumber} of {file.pageCount}
        </span>
        {page.rotation ? <span className="shrink-0">{page.rotation}°</span> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canRemove}
          onClick={() => onRemove(page.id)}
          aria-label={`Remove page ${page.pageNumber} from ${file.name}`}
          className="ml-auto size-7 shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}

interface PageCardPreviewProps {
  readonly page: PdfPageEntry
  readonly file: PdfFileEntry
  readonly index: number
}

export function PageCardPreview({ page, file, index }: PageCardPreviewProps) {
  return (
    <div
      aria-hidden
      className="relative w-48 rotate-2 overflow-hidden rounded-xl bg-surface-container-lowest shadow-elevation-3 ring-2 ring-primary"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground tabular-nums">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{file.name}</span>
      </div>
      <div className="relative aspect-[210/297] bg-white">
        <PageThumbnail
          fileId={file.id}
          file={file.file}
          pageNumber={page.pageNumber}
          password={file.password}
          rotation={page.rotation ?? 0}
        />
      </div>
      <div className="flex items-center gap-1.5 border-t border-outline-variant px-2 py-1.5 text-xs text-muted-foreground">
        <FileTextIcon className="size-3 shrink-0" />
        <span className="tabular-nums">
          Page {page.pageNumber} of {file.pageCount}
        </span>
      </div>
    </div>
  )
}
