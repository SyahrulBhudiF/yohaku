import { UploadIcon } from "lucide-react"
import { useRef, useState } from "react"

import { cn } from "@/libs/utils/cn"

interface DropzoneProps {
  readonly onFile: (file: File) => void
}

export function Dropzone({ onFile }: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (file: File | undefined) => {
    if (file) {
      onFile(file)
    }
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        accept(event.dataTransfer.files[0])
      }}
      className={cn(
        "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-outline bg-surface-container-low px-6 py-16 text-center transition-colors outline-none hover:bg-surface-container focus-visible:ring-3 focus-visible:ring-ring/50",
        dragging && "border-primary bg-primary-container",
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <UploadIcon className="size-6" />
      </span>
      <span className="text-base font-medium">Drop an image here, or click to browse</span>
      <span className="text-sm text-muted-foreground">
        PNG, JPEG, WebP, AVIF, GIF or TIFF, up to 25 MB
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          accept(event.target.files?.[0])
          event.target.value = ""
        }}
      />
    </button>
  )
}
