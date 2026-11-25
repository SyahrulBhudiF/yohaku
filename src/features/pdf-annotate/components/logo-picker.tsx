import { ImageIcon, XIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"

interface LogoPickerProps {
  readonly logo: File | null
  readonly previewUrl: string | null
  readonly onSelect: (file: File | undefined) => void
  readonly onRemove: () => void
}

export function LogoPicker({ logo, previewUrl, onSelect, onRemove }: LogoPickerProps) {
  const input = useRef<HTMLInputElement>(null)

  if (logo && previewUrl) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3">
        <img
          src={previewUrl}
          alt=""
          className="size-12 rounded-md bg-white object-contain ring-1 ring-outline-variant"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{logo.name}</p>
          <p className="text-xs text-muted-foreground">PNG or JPEG</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Remove watermark image"
        >
          <XIcon />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-outline bg-surface-container-low p-3 text-left transition-colors hover:bg-surface-container focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <ImageIcon className="size-5" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium">Choose a logo</span>
          <span className="text-xs text-muted-foreground">PNG or JPEG</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        hidden
        onChange={(event) => {
          onSelect(event.target.files?.[0])
          event.target.value = ""
        }}
      />
    </div>
  )
}
