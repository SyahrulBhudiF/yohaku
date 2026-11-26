import { type LucideIcon, UploadIcon } from "lucide-react"
import { useRef, useState } from "react"

import { MAX_IMAGE_BYTES } from "@/libs/schemas/image"
import { cn } from "@/libs/utils/cn"

interface DropzoneProps {
  readonly onFiles: (files: ReadonlyArray<File>) => void
  readonly multiple?: boolean
  readonly compact?: boolean
  readonly disabled?: boolean
  readonly label?: string
  readonly hint?: string
  readonly accept?: string
  readonly icon?: LucideIcon
  readonly className?: string
}

export function Dropzone({
  onFiles,
  multiple = false,
  compact = false,
  disabled = false,
  label,
  hint,
  accept:
    acceptedTypes = "image/png,image/jpeg,image/webp,image/avif,image/gif,image/tiff,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.avif,.gif,.tif,.tiff,.heic,.heif",
  icon: Icon = UploadIcon,
  className,
}: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    onFiles(multiple ? [...files] : [files[0]!])
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => input.current?.click()}
      // dnd-kit handles in-app ordering. An OS file drag exposes its files only
      // on the native drop event, so the upload target keeps these handlers.
      onDragOver={(event) => {
        event.preventDefault()

        if (!disabled) {
          setDragging(true)
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)

        if (!disabled) {
          accept(event.dataTransfer.files)
        }
      }}
      className={cn(
        "flex w-full items-center rounded-xl border-2 border-dashed border-outline bg-surface-container-low text-left transition-colors outline-none hover:bg-surface-container focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "gap-3 px-4 py-3" : "flex-col gap-3 px-6 py-16 text-center",
        dragging && "border-primary bg-primary-container",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-primary-container text-on-primary-container",
          compact ? "size-10" : "size-14",
        )}
      >
        <Icon className={compact ? "size-5" : "size-6"} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {label ??
            (multiple
              ? "Drop images here, or click to browse"
              : "Drop an image here, or click to browse")}
        </span>
        <span className="text-sm text-muted-foreground">
          {hint ??
            `PNG, JPEG, WebP, AVIF, HEIC, GIF or TIFF, up to ${MAX_IMAGE_BYTES / 1024 / 1024} MB${multiple ? " each" : ""}`}
        </span>
      </span>
      <input
        ref={input}
        type="file"
        accept={acceptedTypes}
        multiple={multiple}
        hidden
        onChange={(event) => {
          accept(event.target.files)
          event.target.value = ""
        }}
      />
    </button>
  )
}
