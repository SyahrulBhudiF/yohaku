import { useQuery } from "@tanstack/react-query"

import type { PdfFileEntry } from "@/features/pdf-tools/store"
import { getPdfPagePreview } from "@/features/pdf-tools/thumbnails"
import type { useSignPdf } from "../use-sign-pdf"
import { useSignatureGesture, type ResizeHandle } from "../use-signature-gesture"

const handles: { direction: ResizeHandle; position: string; label: string }[] = [
  { direction: "nw", position: "left-0 top-0 cursor-nwse-resize", label: "top left" },
  { direction: "n", position: "left-1/2 top-0 cursor-ns-resize", label: "top" },
  { direction: "ne", position: "left-full top-0 cursor-nesw-resize", label: "top right" },
  { direction: "e", position: "left-full top-1/2 cursor-ew-resize", label: "right" },
  { direction: "se", position: "left-full top-full cursor-nwse-resize", label: "bottom right" },
  { direction: "s", position: "left-1/2 top-full cursor-ns-resize", label: "bottom" },
  { direction: "sw", position: "left-0 top-full cursor-nesw-resize", label: "bottom left" },
  { direction: "w", position: "left-0 top-1/2 cursor-ew-resize", label: "left" },
]

export function PdfSignPage({
  file,
  pageNumber,
  model,
}: {
  file: PdfFileEntry
  pageNumber: number
  model: ReturnType<typeof useSignPdf>
}) {
  const selectSignature = (id: string) => {
    if (model.page !== pageNumber) model.changePage(pageNumber)
    model.select(id)
  }
  const { page: pageRef, start, move, stop } = useSignatureGesture(selectSignature, model.update)
  const preview = useQuery({
    queryKey: ["pdf-sign-preview", file.id, pageNumber],
    queryFn: () => getPdfPagePreview(file.id, file.file, pageNumber, file.password, 900),
    staleTime: Infinity,
    retry: false,
  })

  return (
    <div>
      <p className="pb-2 text-sm text-muted-foreground">Page {pageNumber}</p>
      {preview.data ? (
        <div
          ref={pageRef}
          className="relative w-full overflow-hidden bg-white shadow-sm"
          style={{ aspectRatio: preview.data.aspect }}
        >
          <img
            src={preview.data.url}
            alt={`PDF page ${pageNumber}`}
            className="absolute inset-0 size-full"
            draggable={false}
          />
          {model.placements
            .filter((item) => item.page === pageNumber)
            .map((item, index) => (
              <div
                key={item.id}
                data-signature-id={item.id}
                className={`absolute ${model.selected === item.id ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary"}`}
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  width: `${item.width * 100}%`,
                  height: `${item.height * 100}%`,
                }}
              >
                <button
                  type="button"
                  aria-label={`Select and move signature ${index + 1} on page ${pageNumber}`}
                  className="size-full touch-none cursor-grab active:cursor-grabbing"
                  onClick={() => selectSignature(item.id)}
                  onPointerDown={(event) => start(event, item, "move")}
                  onPointerMove={move}
                  onPointerUp={stop}
                  onPointerCancel={stop}
                  onLostPointerCapture={stop}
                >
                  <img src={item.url} alt="" className="size-full" draggable={false} />
                </button>
                {model.selected === item.id &&
                  handles.map(({ direction, position, label }) => (
                    <button
                      key={direction}
                      type="button"
                      aria-label={`Resize ${label} of signature ${index + 1} on page ${pageNumber}; use the size slider for keyboard control`}
                      className={`absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 touch-none border-2 border-primary bg-background shadow-sm ${position}`}
                      onPointerDown={(event) => start(event, item, direction)}
                      onPointerMove={move}
                      onPointerUp={stop}
                      onPointerCancel={stop}
                      onLostPointerCapture={stop}
                    />
                  ))}
              </div>
            ))}
        </div>
      ) : preview.isError || (preview.isSuccess && !preview.data) ? (
        <p role="alert">Could not render page {pageNumber}.</p>
      ) : (
        <div className="h-96 animate-pulse rounded-xl bg-surface-container-high" />
      )}
    </div>
  )
}
