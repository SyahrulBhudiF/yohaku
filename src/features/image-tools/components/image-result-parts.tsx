import { DownloadIcon, FileImageIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/libs/utils/cn"
import { formatBytes } from "@/libs/utils/format"
import type { ImageResult } from "../store"

export function Checkerboard({
  children,
  className,
}: {
  readonly children: React.ReactNode
  readonly className?: string
}) {
  return <div className={cn("checkerboard overflow-hidden rounded-md", className)}>{children}</div>
}

export function ImageFileCard({
  file,
  previewUrl,
  disabled,
  onRemove,
  showPreview = true,
}: {
  readonly file: File
  readonly previewUrl: string | null
  readonly disabled: boolean
  readonly onRemove: () => void
  readonly showPreview?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
            <FileImageIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{file.name}</CardTitle>
            <CardDescription>{formatBytes(file.size)}</CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
            className="shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
          >
            <XIcon />
          </Button>
        </div>
      </CardHeader>
      {showPreview && previewUrl && (
        <CardContent className="flex flex-col gap-4">
          <Checkerboard className="flex max-h-80 min-h-40 items-center justify-center">
            <img
              src={previewUrl}
              alt="Preview of the selected file"
              className="max-h-80 w-full object-contain"
            />
          </Checkerboard>
        </CardContent>
      )}
    </Card>
  )
}

export function ImageResultCard({
  result,
  title,
  description,
  children,
}: {
  readonly result: ImageResult
  readonly title: string
  readonly description: string
  readonly children?: React.ReactNode
}) {
  return (
    <Card size="sm" className="bg-tertiary-container text-on-tertiary-container">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-on-tertiary-container/80">
          {description} · {formatBytes(result.inputBytes)} → {formatBytes(result.bytes)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        <Button
          render={
            <a
              href={result.url}
              download={result.fileName}
              aria-label={`Download ${result.fileName}`}
            />
          }
          nativeButton={false}
          className="self-start"
        >
          <DownloadIcon /> Download {result.fileName}
        </Button>
      </CardContent>
    </Card>
  )
}
