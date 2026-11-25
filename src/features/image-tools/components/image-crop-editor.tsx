import { useRef, type KeyboardEvent, type PointerEvent } from "react"

import type { CropRect } from "@/libs/schemas/image"
import { moveCropRect, resizeCropRect, type CropHandle } from "@/libs/utils/image-resize"

const handles: ReadonlyArray<{
  readonly handle: CropHandle
  readonly className: string
  readonly label: string
}> = [
  {
    handle: "nw",
    className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    label: "top left",
  },
  {
    handle: "n",
    className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
    label: "top",
  },
  {
    handle: "ne",
    className: "left-full top-0 -translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    label: "top right",
  },
  {
    handle: "e",
    className: "left-full top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    label: "right",
  },
  {
    handle: "se",
    className: "left-full top-full -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    label: "bottom right",
  },
  {
    handle: "s",
    className: "left-1/2 top-full -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
    label: "bottom",
  },
  {
    handle: "sw",
    className: "left-0 top-full -translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    label: "bottom left",
  },
  {
    handle: "w",
    className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    label: "left",
  },
]

interface Gesture {
  readonly pointerId: number
  readonly mode: CropHandle | "move"
  readonly startX: number
  readonly startY: number
  readonly boundsWidth: number
  readonly boundsHeight: number
  readonly start: CropRect
  readonly aspect: number | null
  readonly sourceAspect: number
}

interface ImageCropEditorProps {
  readonly src: string
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly crop: CropRect
  readonly aspect: number | null
  readonly disabled?: boolean
  readonly onChange: (crop: CropRect) => void
}

export function ImageCropEditor({
  src,
  sourceWidth,
  sourceHeight,
  crop,
  aspect,
  disabled = false,
  onChange,
}: ImageCropEditorProps) {
  const container = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const sourceAspect = sourceWidth / sourceHeight

  const start = (event: PointerEvent<HTMLElement>, mode: CropHandle | "move") => {
    if (disabled || event.button !== 0) return

    const bounds = container.current?.getBoundingClientRect()

    if (!bounds || bounds.width === 0 || bounds.height === 0) return

    event.preventDefault()
    event.stopPropagation()
    container.current?.setPointerCapture(event.pointerId)
    gesture.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      boundsWidth: bounds.width,
      boundsHeight: bounds.height,
      start: crop,
      aspect,
      sourceAspect,
    }
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current

    if (!current || current.pointerId !== event.pointerId) return

    const dx = (event.clientX - current.startX) / current.boundsWidth
    const dy = (event.clientY - current.startY) / current.boundsHeight
    const next =
      current.mode === "move"
        ? moveCropRect(current.start, dx, dy)
        : resizeCropRect(current.start, current.mode, dx, dy, current.aspect, current.sourceAspect)

    onChange(next)
  }

  const stop = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId === event.pointerId) {
      gesture.current = null
    }

    if (container.current?.hasPointerCapture(event.pointerId)) {
      container.current.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01
    let dx = 0
    let dy = 0

    switch (event.key) {
      case "ArrowLeft":
        dx = -step
        break
      case "ArrowRight":
        dx = step
        break
      case "ArrowUp":
        dy = -step
        break
      case "ArrowDown":
        dy = step
        break
      default:
        return
    }

    event.preventDefault()
    onChange(moveCropRect(crop, dx, dy))
  }

  return (
    <div
      ref={container}
      className="relative w-full touch-none overflow-hidden rounded-md bg-surface-container select-none"
      style={{ aspectRatio: `${sourceWidth} / ${sourceHeight}` }}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <img
        src={src}
        alt="Crop source"
        className="absolute inset-0 size-full object-contain"
        draggable={false}
      />
      <div
        className="absolute border-2 border-primary"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
          boxShadow: "0 0 0 9999px color-mix(in srgb, var(--md-scrim) 55%, transparent)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="border border-primary/30" />
          ))}
        </div>
        <button
          type="button"
          aria-label="Move crop area. Use arrow keys to move."
          aria-disabled={disabled}
          disabled={disabled}
          className="absolute inset-0 cursor-move touch-none bg-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onPointerDown={(event) => start(event, "move")}
          onKeyDown={handleKeyDown}
        />
        {handles.map(({ handle, className, label }) => (
          <button
            key={handle}
            type="button"
            aria-label={`Resize crop from ${label}`}
            className={`absolute size-3 rounded-full border-2 border-surface bg-primary shadow-elevation-1 ${className}`}
            onPointerDown={(event) => start(event, handle)}
          />
        ))}
      </div>
    </div>
  )
}
