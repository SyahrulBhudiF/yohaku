import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { DownloadIcon, ImagesIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  BatchImageFormSchema,
  IMAGE_FORMATS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_FILES,
  MAX_IMAGE_TOTAL_BYTES,
  type BatchImageFormValues,
} from "@/libs/schemas/image"
import { formatBytes } from "@/libs/utils/format"
import { preloadImageCodec } from "@/libs/utils/image-codec"
import { compressImages } from "../batch-process"
import { useBatchCompressStore } from "../batch-store"
import { prepareImageFiles } from "../process"
import { BatchImageGrid } from "./batch-image-grid"
import { Dropzone } from "./dropzone"

const formatLabel = (format: BatchImageFormValues["format"]) =>
  format === "original" ? "Keep original" : format.toUpperCase()

const isImageFormat = Schema.is(Schema.Literals(IMAGE_FORMATS))

const toChoice = (value: string | null): BatchImageFormValues["format"] =>
  value === "original" ? value : value !== null && isImageFormat(value) ? value : "original"

export function BatchCompressPage() {
  const { files, result, addFiles, removeFile, setResult, clearResult, reset } =
    useBatchCompressStore()
  const [error, setError] = useState<string | null>(null)
  const compress = useMutation({
    mutationFn: compressImages,
    onSuccess: setResult,
  })
  const addFilesMutation = useMutation({ mutationFn: prepareImageFiles })
  const form = useForm({
    defaultValues: {
      format: "original",
      quality: 80,
    } as BatchImageFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(BatchImageFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        compress.reset()
        setError(null)
      },
    },
    onSubmit: ({ value }) => {
      if (files.length === 0) {
        return
      }

      setError(null)
      compress.mutate({ files, format: value.format, quality: value.quality })
    },
  })
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  const errorMessage = error ?? addFilesMutation.error?.message ?? compress.error?.message ?? null
  const saved = result ? Math.round((1 - result.outputBytes / result.inputBytes) * 100) : 0

  const resetMutation = () => {
    compress.reset()
    addFilesMutation.reset()
    setError(null)
  }

  const handleFiles = (incoming: ReadonlyArray<File>) => {
    resetMutation()

    if (form.state.values.format !== "original") {
      preloadImageCodec(form.state.values.format)
    }

    addFilesMutation.mutate(
      { files: incoming, existingFileCount: files.length, existingTotalBytes: totalBytes },
      {
        onSuccess: (batch) => {
          if (batch.accepted.length > 0) {
            addFiles(batch.accepted)
          }

          if (batch.errors.length > 0) {
            setError(batch.errors[0] ?? null)
          }
        },
      },
    )
  }

  const handleRemove = (id: string) => {
    resetMutation()
    removeFile(id)
  }

  const handleReset = () => {
    resetMutation()
    form.reset()
    reset()
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ToolPageHeader id="image-batch-compress" japanese="画像の一括圧縮">
        <h1 className="text-3xl font-normal tracking-tight">Batch compress images</h1>
        <p className="text-muted-foreground">
          Compress up to {MAX_IMAGE_FILES} images with one set of settings and download them as a
          ZIP. Everything runs in your browser.
        </p>
      </ToolPageHeader>

      {files.length === 0 ? (
        <Dropzone
          multiple
          disabled={addFilesMutation.isPending}
          onFiles={handleFiles}
          hint={`Up to ${MAX_IMAGE_FILES} images · ${MAX_IMAGE_TOTAL_BYTES / 1024 / 1024} MB total · ${MAX_IMAGE_BYTES / 1024 / 1024} MB each`}
        />
      ) : (
        <Dropzone
          multiple
          compact
          disabled={compress.isPending || addFilesMutation.isPending}
          onFiles={handleFiles}
          label={addFilesMutation.isPending ? "Reading images…" : "Add more images"}
          hint={`Up to ${MAX_IMAGE_FILES} images · ${MAX_IMAGE_TOTAL_BYTES / 1024 / 1024} MB total`}
        />
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {errorMessage}
        </p>
      )}

      {files.length > 0 && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              {files.length} {files.length === 1 ? "image" : "images"}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatBytes(totalBytes)} selected
            </p>
          </div>

          <BatchImageGrid
            files={files}
            result={result}
            disabled={compress.isPending}
            onRemove={handleRemove}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compression</CardTitle>
              <CardDescription>One setting applies to every image in this batch.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="batch-image-form"
                className="flex flex-col gap-6"
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit()
                }}
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <form.Field name="format">
                    {(field) => (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Output format</span>
                        <Select
                          value={field.state.value}
                          disabled={compress.isPending}
                          onValueChange={(value) => {
                            const format = toChoice(value)

                            field.handleChange(format)

                            if (format !== "original") {
                              preloadImageCodec(format)
                            }
                          }}
                        >
                          <SelectTrigger className="w-full" aria-label="Output format">
                            <SelectValue>{formatLabel(field.state.value)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="original">Keep original</SelectItem>
                            {IMAGE_FORMATS.map((format) => (
                              <SelectItem key={format} value={format}>
                                {format.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="quality">
                    {(field) => (
                      <div className="flex flex-col gap-4">
                        <span className="flex justify-between text-sm font-medium">
                          Quality
                          <span className="text-muted-foreground tabular-nums">
                            {field.state.value}
                          </span>
                        </span>
                        <Slider
                          min={1}
                          max={100}
                          value={[field.state.value]}
                          disabled={compress.isPending}
                          aria-label="Quality"
                          onValueChange={(value) =>
                            field.handleChange(
                              Array.isArray(value) ? (value[0] ?? field.state.value) : value,
                            )
                          }
                        />
                      </div>
                    )}
                  </form.Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG and TIFF are lossless. Quality sets JPEG, WebP and AVIF strength and the GIF
                  palette. A file is never replaced by a larger re-encode.
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={handleReset} disabled={compress.isPending}>
              <Trash2Icon /> Clear
            </Button>
            <Button
              type="button"
              onClick={() => void form.handleSubmit()}
              disabled={compress.isPending || addFilesMutation.isPending}
            >
              {compress.isPending ? <Loader2Icon className="animate-spin" /> : <ImagesIcon />}
              {compress.isPending
                ? "Compressing…"
                : `Compress ${files.length} ${files.length === 1 ? "image" : "images"}`}
            </Button>
          </div>

          {result && (
            <section className="rounded-xl bg-tertiary-container p-4 text-on-tertiary-container">
              <p className="font-medium">ZIP ready</p>
              <p className="mt-1 text-sm">
                {result.items.length} {result.items.length === 1 ? "image" : "images"} ·{" "}
                {formatBytes(result.inputBytes)} → {formatBytes(result.outputBytes)}
                {saved > 0 ? ` · ${saved}% smaller` : " · no smaller files"}
              </p>
              <p className="mt-1 text-xs text-on-tertiary-container/80">
                ZIP {formatBytes(result.zipBytes)}
                {result.failures.length > 0 ? ` · ${result.failures.length} skipped` : ""}
              </p>
              {result.failures.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {result.failures.map((failure) => (
                    <li key={failure.id}>
                      {failure.name}: {failure.message}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="mt-3"
                render={
                  <a
                    href={result.url}
                    download={result.fileName}
                    aria-label={`Download ${result.fileName}`}
                  />
                }
                nativeButton={false}
              >
                <DownloadIcon /> Download {result.fileName}
              </Button>
            </section>
          )}
        </>
      )}
    </main>
  )
}
