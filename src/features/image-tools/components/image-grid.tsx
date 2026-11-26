import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon, ImageOffIcon, XIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/libs/utils/cn"
import { formatBytes } from "@/libs/utils/format"
import { useImagePreview } from "../use-image-preview"
import type { ImagePdfFileEntry } from "../store"

function ImageThumbnail({ entry }: { readonly entry: ImagePdfFileEntry }) {
  const preview = useImagePreview(entry.file, entry.previewUrl)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <ImageOffIcon className="size-7" />
      </div>
    )
  }

  return (
    <img
      src={preview.url ?? undefined}
      alt={entry.name}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  )
}

interface ImageCardProps {
  readonly entry: ImagePdfFileEntry
  readonly index: number
  readonly onRemove: (id: string) => void
  readonly disabled: boolean
}

function ImageCard({ entry, index, onRemove, disabled }: ImageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    data: { type: "image" },
    attributes: { roleDescription: `Image ${index + 1}` },
    disabled,
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
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={entry.name}>
          {entry.name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`Drag ${entry.name}`}
          className="shrink-0 cursor-grab touch-none text-on-surface-variant active:cursor-grabbing"
        >
          <GripVerticalIcon />
        </Button>
      </div>
      <div className="relative aspect-[4/3] bg-white">
        <ImageThumbnail entry={entry} />
      </div>
      <div className="flex items-center gap-1.5 border-t border-outline-variant px-2 py-1 text-xs text-muted-foreground">
        <span className="min-w-0 truncate tabular-nums">{formatBytes(entry.size)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(entry.id)}
          disabled={disabled}
          aria-label={`Remove ${entry.name}`}
          className="ml-auto size-7 shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}

function ImageCardPreview({
  entry,
  index,
}: {
  readonly entry: ImagePdfFileEntry
  readonly index: number
}) {
  return (
    <div
      aria-hidden
      className="relative w-48 rotate-2 overflow-hidden rounded-xl bg-surface-container-lowest shadow-elevation-3 ring-2 ring-primary"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground tabular-nums">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{entry.name}</span>
      </div>
      <div className="relative aspect-[4/3] bg-white">
        <ImageThumbnail entry={entry} />
      </div>
      <div className="border-t border-outline-variant px-2 py-1.5 text-xs text-muted-foreground tabular-nums">
        {formatBytes(entry.size)}
      </div>
    </div>
  )
}

interface ImageGridProps {
  readonly files: ReadonlyArray<ImagePdfFileEntry>
  readonly onReorder: (files: ReadonlyArray<ImagePdfFileEntry>) => void
  readonly onRemove: (id: string) => void
  readonly disabled?: boolean
}

export function ImageGrid({ files, onReorder, onRemove, disabled = false }: ImageGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = useMemo(() => files.map((file) => file.id), [files])
  const activeIndex = activeId ? files.findIndex((file) => file.id === activeId) : -1
  const activeFile = activeIndex >= 0 ? files[activeIndex] : undefined
  const announcements: Announcements = {
    onDragStart({ active }) {
      const index = files.findIndex((file) => file.id === active.id)

      return index < 0
        ? undefined
        : `Picked up ${files[index]!.name} at position ${index + 1} of ${files.length}.`
    },
    onDragOver({ active, over }) {
      if (!over) {
        return undefined
      }

      const file = files.find((item) => item.id === active.id)
      const overIndex = files.findIndex((item) => item.id === over.id)

      return file && overIndex >= 0
        ? `${file.name} is over position ${overIndex + 1} of ${files.length}.`
        : undefined
    },
    onDragEnd({ active, over }) {
      const file = files.find((item) => item.id === active.id)
      const overIndex = over ? files.findIndex((item) => item.id === over.id) : -1

      return file
        ? overIndex < 0
          ? `${file.name} dropped.`
          : `${file.name} moved to position ${overIndex + 1} of ${files.length}.`
        : undefined
    },
    onDragCancel({ active }) {
      const file = files.find((item) => item.id === active.id)

      return file ? `Moving ${file.name} cancelled.` : "Moving image cancelled."
    },
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = files.findIndex((file) => file.id === active.id)
    const newIndex = files.findIndex((file) => file.id === over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    onReorder(arrayMove([...files], oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((file, index) => (
            <ImageCard
              key={file.id}
              entry={file}
              index={index}
              onRemove={onRemove}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeFile ? <ImageCardPreview entry={activeFile} index={activeIndex} /> : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  )
}
