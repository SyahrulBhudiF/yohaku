import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { DownloadIcon, FilePlus2Icon, Loader2Icon, Trash2Icon } from "lucide-react"
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
import { MAX_IMAGE_BYTES } from "@/libs/schemas/image"
import {
  ImagePdfFormSchema,
  type ImagePdfFormValues,
  type ImagePdfMode,
  type ImagePdfPageSize,
} from "@/libs/schemas/pdf"
import { preloadImageCodec } from "@/libs/utils/image-codec"
import { formatBytes } from "@/libs/utils/format"
import { prepareImageFiles, processImagesToPdf } from "../process"
import { useImageToPdfStore, type ImagePdfFileEntry } from "../store"
import { Dropzone } from "./dropzone"
import { ImageGrid } from "./image-grid"

const MODE_LABEL: Record<ImagePdfMode, string> = {
  one: "One PDF",
  separate: "One PDF per image",
}

const PAGE_SIZE_LABEL: Record<ImagePdfPageSize, string> = {
  fit: "Fit image",
  a4: "A4 page",
}

export function ImageToPdfPage() {
  const { files, result, addFiles, removeFile, setFiles, setResult, clearResult, reset } =
    useImageToPdfStore()
  const createPdf = useMutation({
    mutationFn: processImagesToPdf,
    onSuccess: setResult,
  })
  const addFilesMutation = useMutation({ mutationFn: prepareImageFiles })
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      mode: "one",
      pageSize: "fit",
      quality: 90,
    } as ImagePdfFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(ImagePdfFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        createPdf.reset()
        setError(null)
      },
    },
    onSubmit: ({ value }) => {
      if (files.length === 0) {
        return
      }

      setError(null)
      createPdf.mutate({
        files,
        mode: value.mode,
        pageSize: value.pageSize,
        quality: value.quality,
      })
    },
  })
  const values = form.state.values
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  const outputCount = values.mode === "one" ? 1 : files.length
  const errorMessage = error ?? createPdf.error?.message ?? null

  const resetMutation = () => {
    createPdf.reset()
    addFilesMutation.reset()
    setError(null)
  }

  const handleFiles = (incoming: ReadonlyArray<File>) => {
    preloadImageCodec("png")
    resetMutation()
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

  const handleReorder = (next: ReadonlyArray<ImagePdfFileEntry>) => {
    resetMutation()
    setFiles(next)
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ToolPageHeader id="image-to-pdf" japanese="画像からPDFへ">
        <h1 className="text-3xl font-normal tracking-tight">Image to PDF</h1>
        <p className="text-muted-foreground">
          Combine images into one PDF, or make one PDF per image. Drag the cards to set the order.
          Everything runs in your browser.
        </p>
      </ToolPageHeader>

      {files.length === 0 ? (
        <Dropzone
          multiple
          disabled={createPdf.isPending || addFilesMutation.isPending}
          onFiles={handleFiles}
        />
      ) : (
        <Dropzone
          multiple
          compact
          disabled={createPdf.isPending || addFilesMutation.isPending}
          onFiles={handleFiles}
          label={addFilesMutation.isPending ? "Reading images…" : "Add more images"}
          hint={`PNG, JPEG, WebP, AVIF, GIF or TIFF · up to ${MAX_IMAGE_BYTES / 1024 / 1024} MB each`}
        />
      )}

      {files.length > 0 && (
        <>
          <ImageGrid
            files={files}
            disabled={createPdf.isPending}
            onReorder={handleReorder}
            onRemove={handleRemove}
          />

          <form
            id="image-to-pdf-form"
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <form.Field name="mode">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Output</span>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as ImagePdfMode)}
                    >
                      <SelectTrigger className="w-full" aria-label="Output">
                        <SelectValue>{MODE_LABEL[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one">One PDF</SelectItem>
                        <SelectItem value="separate">One PDF per image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              <form.Field name="pageSize">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Page size</span>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as ImagePdfPageSize)}
                    >
                      <SelectTrigger className="w-full" aria-label="Page size">
                        <SelectValue>{PAGE_SIZE_LABEL[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fit">Fit image</SelectItem>
                        <SelectItem value="a4">A4 page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="quality">
              {(field) => (
                <div className="flex flex-col gap-4">
                  <span className="flex justify-between text-sm font-medium">
                    Re-encode quality
                    <span className="text-muted-foreground tabular-nums">{field.state.value}</span>
                  </span>
                  <Slider
                    min={1}
                    max={100}
                    value={[field.state.value]}
                    aria-label="Re-encode quality"
                    onValueChange={(value) =>
                      field.handleChange(
                        Array.isArray(value) ? (value[0] ?? field.state.value) : value,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Upright JPEGs and PNGs are embedded as-is. Quality applies when a JPEG must be
                    rotated or another format is converted.
                  </p>
                  {field.state.meta.errors.length > 0 && (
                    <p role="alert" className="text-sm text-error">
                      Quality must be a whole number from 1 to 100.
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </form>

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <FilePlus2Icon className="size-4" />
              {files.length} {files.length === 1 ? "image" : "images"} · {formatBytes(totalBytes)}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {outputCount === 1
                ? "Downloads as one PDF"
                : `Downloads as a ZIP of ${outputCount} PDFs`}
            </span>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {errorMessage}
            </p>
          )}

          {result && (
            <Card size="sm" className="bg-tertiary-container text-on-tertiary-container">
              <CardHeader>
                <CardTitle className="text-base">
                  {result.pdfs === 1 ? "PDF ready" : `${result.pdfs} PDFs ready`}
                </CardTitle>
                <CardDescription className="text-on-tertiary-container/80">
                  {formatBytes(result.inputBytes)} → {formatBytes(result.bytes)}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={handleReset} disabled={createPdf.isPending}>
              <Trash2Icon /> Clear all
            </Button>
            <Button type="submit" form="image-to-pdf-form" disabled={createPdf.isPending}>
              {createPdf.isPending && <Loader2Icon className="animate-spin" />}
              {createPdf.isPending
                ? "Creating…"
                : outputCount === 1
                  ? "Create PDF"
                  : `Create ${outputCount} PDFs`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
