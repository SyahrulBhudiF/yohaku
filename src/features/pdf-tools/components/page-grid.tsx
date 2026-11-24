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
} from "@dnd-kit/sortable"
import { useMemo, useState } from "react"
import { createPortal } from "react-dom"

import type { PdfFileEntry, PdfPageEntry } from "../store"
import { PageCard, PageCardPreview } from "./page-card"

interface PageGridProps {
  readonly pages: ReadonlyArray<PdfPageEntry>
  readonly files: ReadonlyArray<PdfFileEntry>
  readonly onReorder: (pages: ReadonlyArray<PdfPageEntry>) => void
  readonly onRemove: (pageId: string) => void
  readonly onRotate?: (pageId: string) => void
  readonly minPagesToKeep?: number
}

export function PageGrid({
  pages,
  files,
  onReorder,
  onRemove,
  onRotate,
  minPagesToKeep = 0,
}: PageGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])
  const pageIds = useMemo(() => pages.map((page) => page.id), [pages])
  const activePage = activeId ? pages.find((page) => page.id === activeId) : undefined
  const activeFile = activePage ? fileById.get(activePage.fileId) : undefined
  const activeIndex = activePage ? pages.findIndex((page) => page.id === activePage.id) : -1
  const announcements: Announcements = {
    onDragStart({ active }) {
      const page = pages.find((item) => item.id === active.id)
      const index = pages.findIndex((item) => item.id === active.id)

      if (!page) {
        return undefined
      }

      const file = fileById.get(page.fileId)

      return `Picked up page ${page.pageNumber} from ${file?.name ?? "PDF"} at position ${index + 1} of ${pages.length}.`
    },
    onDragOver({ active, over }) {
      if (!over) {
        return undefined
      }

      const page = pages.find((item) => item.id === active.id)
      const overIndex = pages.findIndex((item) => item.id === over.id)

      if (!page || overIndex < 0) {
        return undefined
      }

      return `Page ${page.pageNumber} is over position ${overIndex + 1} of ${pages.length}.`
    },
    onDragEnd({ active, over }) {
      const page = pages.find((item) => item.id === active.id)
      const overIndex = over ? pages.findIndex((item) => item.id === over.id) : -1

      if (!page) {
        return undefined
      }

      return overIndex < 0
        ? `Page ${page.pageNumber} dropped.`
        : `Page ${page.pageNumber} moved to position ${overIndex + 1} of ${pages.length}.`
    },
    onDragCancel({ active }) {
      const page = pages.find((item) => item.id === active.id)

      return page ? `Moving page ${page.pageNumber} cancelled.` : "Moving page cancelled."
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

    const oldIndex = pages.findIndex((page) => page.id === active.id)
    const newIndex = pages.findIndex((page) => page.id === over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    onReorder(arrayMove([...pages], oldIndex, newIndex))
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
      <SortableContext items={pageIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {pages.map((page, index) => {
            const file = fileById.get(page.fileId)

            if (!file) {
              return null
            }

            return (
              <PageCard
                key={page.id}
                page={page}
                file={file}
                index={index}
                onRemove={onRemove}
                {...(onRotate ? { onRotate } : {})}
                canRemove={pages.length > minPagesToKeep}
              />
            )
          })}
        </div>
      </SortableContext>
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activePage && activeFile ? (
              <PageCardPreview page={activePage} file={activeFile} index={activeIndex} />
            ) : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  )
}
