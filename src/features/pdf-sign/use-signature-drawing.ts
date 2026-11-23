import { useRef, useState, type PointerEvent } from "react"

export function useSignatureDrawing(onSave: (blob: Blob) => void) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [drawn, setDrawn] = useState(false)
  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    const target = canvas.current
    const context = target?.getContext("2d")

    if (!target || !context) return
    const rect = target.getBoundingClientRect()
    const x = ((event.clientX - rect.left) * target.width) / rect.width
    const y = ((event.clientY - rect.top) * target.height) / rect.height

    if (event.type === "pointerdown") {
      target.setPointerCapture(event.pointerId)
      drawing.current = true
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + 0.01, y)
    } else if (!drawing.current) return
    else context.lineTo(x, y)
    context.strokeStyle = "#111111"
    context.lineWidth = 3
    context.lineCap = "round"
    context.lineJoin = "round"
    context.stroke()
    setDrawn(true)
  }

  return {
    canvas,
    drawn,
    draw,
    stop: () => {
      drawing.current = false
    },
    clear: () => {
      const target = canvas.current

      if (target) target.getContext("2d")?.clearRect(0, 0, target.width, target.height)
      setDrawn(false)
    },
    save: () =>
      canvas.current?.toBlob((blob) => {
        if (blob) onSave(blob)
      }, "image/png"),
  }
}
