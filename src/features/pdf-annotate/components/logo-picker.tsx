import { ImageIcon, XIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { Button } from "@/components/ui/button"

interface LogoPickerProps {
  readonly logo: File | null
  readonly previewUrl: string | null
  readonly onSelect: (file: File | undefined) => void
  readonly onRemove: () => void
}

export function LogoPicker({ logo, previewUrl, onSelect, onRemove }: LogoPickerProps) {
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
    <Dropzone
      icon={ImageIcon}
      accept="image/png,image/jpeg,.png,.jpg,.jpeg"
      compact
      label="Choose a logo"
      hint="PNG or JPEG"
      onFiles={(files) => onSelect(files[0])}
    />
  )
}
