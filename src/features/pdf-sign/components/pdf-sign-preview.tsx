import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef } from "react"

import { useSignStore } from "../store"
import type { useSignPdf } from "../use-sign-pdf"
import { PdfSignPage } from "./pdf-sign-page"

export function PdfSignPreview({ model }: { model: ReturnType<typeof useSignPdf> }) {
  const scrollRef = useRef<HTMLElement>(null)
  const virtualizer = useVirtualizer({
    count: model.file?.pageCount ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 850,
    overscan: 1,
    onChange: (instance) => {
      const center = (instance.scrollOffset ?? 0) + (instance.scrollRect?.height ?? 0) / 2
      const visible = instance
        .getVirtualItems()
        .find((item) => item.start <= center && item.end >= center)

      if (visible && visible.index + 1 !== useSignStore.getState().page) {
        model.changePage(visible.index + 1)
      }
    },
  })

  useEffect(() => {
    if (!model.selected || !scrollRef.current) return
    const container = scrollRef.current
    const signature = [...container.querySelectorAll<HTMLElement>("[data-signature-id]")].find(
      (element) => element.dataset.signatureId === model.selected,
    )

    if (!signature) return
    const bounds = container.getBoundingClientRect()
    const target = signature.getBoundingClientRect()

    if (target.top < bounds.top) container.scrollTop += target.top - bounds.top - 16
    else if (target.bottom > bounds.bottom)
      container.scrollTop += target.bottom - bounds.bottom + 16
  }, [model.selected])

  if (!model.file) return null
  const file = model.file

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">Pages</h2>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Adding to page {model.page}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Scroll to a page, then drag signatures to move or resize them. Hold Shift to keep
        proportions.
      </p>
      <section
        ref={scrollRef}
        className="h-[70vh] overflow-auto rounded-xl bg-surface-container p-3"
        aria-label="PDF pages"
        tabIndex={0}
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full pb-4"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <PdfSignPage file={file} pageNumber={item.index + 1} model={model} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
