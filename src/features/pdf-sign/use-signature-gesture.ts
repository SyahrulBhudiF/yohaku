import { useRef, type PointerEvent } from "react"

import type { PlacedSignature } from "./store"

export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

interface Gesture {
  readonly pointerId: number
  readonly mode: "move" | ResizeHandle
  readonly startX: number
  readonly startY: number
  readonly pageWidth: number
  readonly pageHeight: number
  readonly item: PlacedSignature
}

export function useSignatureGesture(
  select: (id: string) => void,
  update: (id: string, changes: Partial<PlacedSignature>) => void,
) {
  const page = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)

  const start = (
    event: PointerEvent<HTMLButtonElement>,
    item: PlacedSignature,
    mode: Gesture["mode"],
  ) => {
    const bounds = page.current?.getBoundingClientRect()

    if (!bounds || !bounds.width || !bounds.height || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    select(item.id)
    gesture.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      pageWidth: bounds.width,
      pageHeight: bounds.height,
      item,
    }
  }

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current

    if (!current || current.pointerId !== event.pointerId) return
    const { item } = current
    const dx = (event.clientX - current.startX) / current.pageWidth
    const dy = (event.clientY - current.startY) / current.pageHeight

    if (current.mode === "move") {
      update(item.id, {
        x: Math.max(0, Math.min(1 - item.width, item.x + dx)),
        y: Math.max(0, Math.min(1 - item.height, item.y + dy)),
      })
    } else {
      const west = current.mode.includes("w")
      const east = current.mode.includes("e")
      const north = current.mode.includes("n")
      const south = current.mode.includes("s")
      const right = item.x + item.width
      const bottom = item.y + item.height
      let x = west ? Math.max(0, Math.min(right - 0.01, item.x + dx)) : item.x
      let y = north ? Math.max(0, Math.min(bottom - 0.01, item.y + dy)) : item.y
      let width = west
        ? right - x
        : east
          ? Math.max(0.01, Math.min(1 - x, item.width + dx))
          : item.width
      let height = north
        ? bottom - y
        : south
          ? Math.max(0.01, Math.min(1 - y, item.height + dy))
          : item.height

      if (event.shiftKey && (west || east) && (north || south)) {
        const widthScale = width / item.width
        const heightScale = height / item.height
        const scale =
          Math.abs(widthScale - 1) >= Math.abs(heightScale - 1) ? widthScale : heightScale
        const maxScale = Math.min(
          (west ? right : 1 - item.x) / item.width,
          (north ? bottom : 1 - item.y) / item.height,
        )

        width = item.width * Math.min(scale, maxScale)
        height = item.height * Math.min(scale, maxScale)
        x = west ? right - width : item.x
        y = north ? bottom - height : item.y
      }

      update(item.id, { x, y, width, height })
    }
  }

  const stop = (event: PointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null
  }

  return { page, start, move, stop }
}
