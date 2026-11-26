import { useMutation } from "@tanstack/react-query"
import { DownloadIcon, FileImageIcon, Loader2Icon, ShieldCheckIcon, XIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InlineError } from "@/features/tools/components/inline-error"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { formatBytes } from "@/libs/utils/format"
import { cleanImageMetadata } from "../process"
import { useMetadataCleanerStore } from "../store"

export function MetadataCleanerPage() {
  const { file, previewUrl, result, setFile, setResult, clearResult, reset } =
    useMetadataCleanerStore()
  const clean = useMutation({
    mutationFn: cleanImageMetadata,
    onSuccess: (output, input) => {
      if (useMetadataCleanerStore.getState().file === input) setResult(output)
    },
  })

  const handleSelect = (files: ReadonlyArray<File>) => {
    const next = files[0]

    if (!next) return

    clean.reset()
    setFile(next)
  }

  const handleRemove = () => {
    clean.reset()
    reset()
  }

  const errorMessage = clean.error?.message ?? null
  const hasMetadata = result !== null && result.removedBytes > 0

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="image-metadata-cleaner" japanese="写真メタデータ削除">
        <h1 className="text-3xl font-normal tracking-tight">Photo metadata cleaner</h1>
        <p className="text-muted-foreground">
          Remove EXIF, GPS, and text metadata from JPEG and PNG images without re-encoding the
          pixels.
        </p>
      </ToolPageHeader>

      {!file && (
        <Dropzone
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          hint="JPEG or PNG · up to 25 MB · pixels stay untouched"
          onFiles={handleSelect}
        />
      )}

      {file && (
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
                onClick={handleRemove}
                disabled={clean.isPending}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="checkerboard flex max-h-72 min-h-40 items-center justify-center overflow-hidden rounded-md">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview of the selected file"
                  className="max-h-72 w-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={clean.isPending}
                aria-busy={clean.isPending}
                onClick={() => {
                  clearResult()
                  clean.mutate(file)
                }}
              >
                {clean.isPending ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />}
                {clean.isPending ? "Removing metadata…" : "Remove metadata"}
              </Button>
              <p className="text-xs text-muted-foreground">
                The image data is copied byte for byte; only metadata segments are removed.
              </p>
            </div>
            <InlineError>{errorMessage}</InlineError>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card
          size="sm"
          className={
            hasMetadata
              ? "bg-tertiary-container text-on-tertiary-container"
              : "bg-surface-container text-on-surface"
          }
        >
          <CardHeader>
            <CardTitle className="text-base">
              {hasMetadata ? "Metadata removed" : "No removable metadata found"}
            </CardTitle>
            <CardDescription
              className={hasMetadata ? "text-on-tertiary-container/80" : "text-muted-foreground"}
            >
              {hasMetadata
                ? `${formatBytes(result.removedBytes)} of metadata removed · ${formatBytes(result.inputBytes)} → ${formatBytes(result.outputBytes)}`
                : "This file already has no EXIF, GPS, or text metadata."}
            </CardDescription>
          </CardHeader>
          {hasMetadata && (
            <CardContent className="flex flex-col gap-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {result.fields.map((field) => (
                  <div key={`${field.label}-${field.value}`} className="flex flex-col gap-0.5">
                    <dt className="text-xs opacity-70">{field.label}</dt>
                    <dd className="truncate font-mono text-xs">{field.value}</dd>
                  </div>
                ))}
              </dl>
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
          )}
        </Card>
      )}
    </main>
  )
}
