import { ImageOffIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { formatBytes } from "@/libs/utils/format"
import { useImagePreview } from "../use-image-preview"
import type { BatchImageEntry, BatchCompressResult } from "../batch-store"

function Thumbnail({ entry }: { readonly entry: BatchImageEntry }) {
  const preview = useImagePreview(entry.file, entry.previewUrl)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <ImageOffIcon className="size-7" />
      </div>
    )
  }

  return (
    <img
      src={preview.url ?? undefined}
      alt={entry.name}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function resultLabel(result: BatchCompressResult | null, id: string) {
  if (!result) {
    return null
  }

  if (result.failures.some((failure) => failure.id === id)) {
    return { text: "Could not compress", tone: "text-error" }
  }

  const item = result.items.find((entry) => entry.id === id)

  if (!item) {
    return null
  }

  const saved = Math.round((1 - item.outputBytes / item.inputBytes) * 100)

  return {
    text:
      saved > 0
        ? `${formatBytes(item.outputBytes)} · ${saved}% smaller`
        : `${formatBytes(item.outputBytes)} · already optimized`,
    tone: saved > 0 ? "text-primary" : "text-muted-foreground",
  }
}

export function BatchImageGrid({
  files,
  result,
  disabled,
  onRemove,
}: {
  readonly files: ReadonlyArray<BatchImageEntry>
  readonly result: BatchCompressResult | null
  readonly disabled: boolean
  readonly onRemove: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {files.map((entry) => {
        const status = resultLabel(result, entry.id)

        return (
          <div
            key={entry.id}
            className="relative overflow-hidden rounded-xl bg-surface-container-lowest ring-1 ring-outline-variant"
          >
            <div className="relative aspect-[4/3] bg-white">
              <Thumbnail entry={entry} />
            </div>
            <div className="flex flex-col gap-0.5 border-t border-outline-variant px-2 py-1.5">
              <span className="truncate text-xs font-medium" title={entry.name}>
                {entry.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatBytes(entry.size)}
              </span>
              {status && (
                <span className={`text-xs font-medium ${status.tone}`}>{status.text}</span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemove(entry.id)}
              disabled={disabled}
              aria-label={`Remove ${entry.name}`}
              className="absolute top-1.5 right-1.5 bg-surface-container-lowest/80 text-on-surface-variant backdrop-blur hover:bg-error-container hover:text-on-error-container"
            >
              <XIcon />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
