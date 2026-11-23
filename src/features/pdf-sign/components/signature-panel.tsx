import { ImagePlusIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { useSignPdf } from "../use-sign-pdf"
import { useSignatureDrawing } from "../use-signature-drawing"

export function SignaturePanel({ model }: { model: ReturnType<typeof useSignPdf> }) {
  const upload = useRef<HTMLInputElement>(null)
  const { canvas, drawn, draw, stop, clear, save } = useSignatureDrawing(
    (blob) => void model.addSignature(blob),
  )
  const active = model.placements.find((item) => item.id === model.selected)

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-container-low p-4">
      <h2 className="text-lg font-medium">Create signature</h2>
      <p className="text-sm text-muted-foreground">Draw with a mouse, pen or finger.</p>
      <canvas
        ref={canvas}
        width={600}
        height={200}
        aria-label="Signature drawing area"
        className="aspect-[3/1] w-full touch-none rounded-md bg-white ring-1 ring-outline"
        onPointerDown={draw}
        onPointerMove={draw}
        onPointerUp={stop}
        onPointerCancel={stop}
      />
      <div className="flex gap-2">
        <Button variant="outline" disabled={!drawn} onClick={clear}>
          Clear
        </Button>
        <Button disabled={!drawn} onClick={save}>
          Save drawing
        </Button>
      </div>
      <Button variant="outline" onClick={() => upload.current?.click()}>
        <ImagePlusIcon /> Upload signature image
      </Button>
      <input
        ref={upload}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const image = event.target.files?.[0]

          if (image) void model.addSignature(image)
          event.target.value = ""
        }}
      />
      {model.signatures.length > 0 && (
        <>
          <h3 className="font-medium">Your signatures</h3>
          <p className="text-sm text-muted-foreground">
            Select a signature to add it to this page.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {model.signatures.map((signature, index) => (
              <button
                key={signature.id}
                type="button"
                disabled={!model.preview}
                onClick={() => model.place(signature)}
                aria-label={`Add signature ${index + 1} to page ${model.page}`}
                className="h-16 overflow-hidden rounded-md bg-white p-1 ring-1 ring-outline hover:ring-primary"
              >
                <img src={signature.url} alt="" className="size-full object-contain" />
              </button>
            ))}
          </div>
        </>
      )}
      {active && (
        <>
          <h3 className="font-medium">Selected signature</h3>
          <div className="flex flex-col gap-2">
            <span className="text-sm">Horizontal position</span>
            <Slider
              aria-label="Horizontal position"
              min={0}
              max={Math.max(0, 1 - active.width)}
              step={0.001}
              value={[active.x]}
              onValueChange={(value) =>
                model.update(active.id, {
                  x: Array.isArray(value) ? (value[0] ?? active.x) : value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm">Vertical position</span>
            <Slider
              aria-label="Vertical position"
              min={0}
              max={Math.max(0, 1 - active.height)}
              step={0.001}
              value={[active.y]}
              onValueChange={(value) =>
                model.update(active.id, {
                  y: Array.isArray(value) ? (value[0] ?? active.y) : value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm">Size</span>
            <Slider
              aria-label="Size"
              min={Math.min(0.05, active.width / active.height)}
              max={Math.min(1, active.width / active.height)}
              step={0.001}
              value={[active.width]}
              onValueChange={(value) =>
                model.resize(active, Array.isArray(value) ? (value[0] ?? active.width) : value)
              }
            />
          </div>
          <Button variant="outline" onClick={() => model.removePlacement(active.id)}>
            Remove signature
          </Button>
        </>
      )}
    </div>
  )
}
