import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { ArrowRightIcon, DownloadIcon, Loader2Icon, XIcon } from "lucide-react"
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
import { IMAGE_FORMATS, ImageToolFormSchema, type ImageToolFormValues } from "@/libs/schemas/image"
import { preloadImageCodec } from "@/libs/utils/image-codec"
import { formatBytes } from "@/libs/utils/format"
import { isPreviewableImageMime } from "@/libs/utils/image-preview"
import { processImageTool, type ImageToolMode } from "../process"
import type { ImageToolStore } from "../store"
import { useImagePreview } from "../use-image-preview"
import { Dropzone } from "@/components/dropzone"

interface ImageToolProps {
  readonly mode: ImageToolMode
  readonly useStore: ImageToolStore
  readonly title: string
  readonly description: string
  readonly allowOriginalFormat: boolean
  readonly allowSvg?: boolean
  readonly actionLabel: string
}

const isImageFormat = Schema.is(Schema.Literals(IMAGE_FORMATS))

const formatLabel = (format: ImageToolFormValues["format"]) =>
  format === "original" ? "Keep original" : format === "svg" ? "SVG" : format.toUpperCase()

const toChoice = (value: string | null): ImageToolFormValues["format"] | null => {
  if (value === "original" || value === "svg") {
    return value
  }

  return value !== null && isImageFormat(value) ? value : null
}

function ResultPreview({
  url,
  mimeType,
  fileName,
}: {
  readonly url: string
  readonly mimeType: string
  readonly fileName: string
}) {
  const [failed, setFailed] = useState(false)

  if (!isPreviewableImageMime(mimeType) || failed) {
    return (
      <p className="text-sm">
        {failed
          ? "This result could not be previewed in your browser. Download it to view the file."
          : "This format has no browser preview. Download the file to view it."}
      </p>
    )
  }

  return (
    <img
      src={url}
      alt={`Result preview of ${fileName}`}
      className="max-h-72 w-full rounded-md bg-surface-container object-contain"
      onError={() => setFailed(true)}
    />
  )
}

export function ImageTool({
  mode,
  useStore,
  title,
  description,
  allowOriginalFormat,
  allowSvg = false,
  actionLabel,
}: ImageToolProps) {
  const { file, previewUrl, result, setFile, setResult, clearResult } = useStore()
  const preview = useImagePreview(file, previewUrl)
  const mutation = useMutation({
    mutationFn: (input: {
      readonly file: File
      readonly format: ImageToolFormValues["format"]
      readonly quality: number
    }) => processImageTool({ ...input, mode }),
    onSuccess: (output, input) => {
      if (useStore.getState().file === input.file) {
        setResult(output)
      }
    },
  })
  const form = useForm({
    defaultValues: {
      format: allowOriginalFormat ? "original" : "webp",
      quality: 80,
    } as ImageToolFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(ImageToolFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        mutation.reset()
      },
    },
    onSubmit: ({ value }) => {
      if (!file) {
        return
      }

      mutation.mutate({ file, format: value.format, quality: value.quality })
    },
  })
  const preload = (choice: ImageToolFormValues["format"]) => {
    if (choice !== "original" && choice !== "svg") {
      preloadImageCodec(choice)
    }
  }

  const saved = result ? Math.round((1 - result.resultBytes / result.originalBytes) * 100) : 0
  const sizeLabel =
    result?.mimeType === "image/svg+xml"
      ? "SVG"
      : saved > 0
        ? `${saved}% smaller`
        : saved === 0
          ? mode === "compress"
            ? "Already optimized"
            : "Same size"
          : `${-saved}% larger`
  const error = mutation.error?.message ?? null
  const reset = () => {
    mutation.reset()
    setFile(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader
        id={mode === "convert" ? "image-convert" : "image-compress"}
        japanese={mode === "convert" ? "画像変換" : "画像圧縮"}
      >
        <h1 className="text-3xl font-normal tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </ToolPageHeader>

      {file === null ? (
        <Dropzone
          onFiles={(files) => {
            preload(form.state.values.format)
            setFile(files[0] ?? null)
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="truncate text-base">{file.name}</CardTitle>
            <CardDescription>{formatBytes(file.size)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {preview.url ? (
              <img
                src={preview.url}
                alt="Selected file preview"
                className="max-h-72 w-full rounded-md bg-surface-container object-contain"
              />
            ) : preview.isPending ? (
              <p className="text-sm text-muted-foreground">Preparing HEIC preview…</p>
            ) : preview.error ? (
              <p className="text-sm text-muted-foreground">
                Preview unavailable; conversion still works.
              </p>
            ) : null}

            <form
              id="image-tool-form"
              className="grid gap-6 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
            >
              <form.Field name="format">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Output format</span>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        const choice = toChoice(value) ?? "webp"

                        field.handleChange(choice)
                        preload(choice)
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label="Image format">
                        <SelectValue>{formatLabel(field.state.value)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {allowOriginalFormat && (
                          <SelectItem value="original">Keep original</SelectItem>
                        )}
                        {allowSvg && <SelectItem value="svg">SVG</SelectItem>}
                        {IMAGE_FORMATS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              {form.state.values.format === "svg" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Tracing</span>
                  <p className="text-xs text-muted-foreground">
                    High-detail trace at up to 1024 px.
                  </p>
                </div>
              ) : (
                <form.Field name="quality">
                  {(field) => (
                    <div className="flex flex-col gap-4">
                      <span className="flex justify-between text-sm font-medium">
                        Quality{" "}
                        <span className="text-muted-foreground tabular-nums">
                          {field.state.value}
                        </span>
                      </span>
                      <Slider
                        min={1}
                        max={100}
                        value={[field.state.value]}
                        aria-label="Quality"
                        onValueChange={(value) =>
                          field.handleChange(
                            Array.isArray(value) ? (value[0] ?? field.state.value) : value,
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        PNG and TIFF are lossless. Quality sets JPEG, WebP and AVIF strength and the
                        GIF palette. Animated GIFs and WebPs keep their frames when the output is
                        GIF or WebP.
                      </p>
                      {field.state.meta.errors.length > 0 && (
                        <p role="alert" className="text-sm text-error">
                          Quality must be a whole number from 1 to 100.
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
              )}
            </form>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
              >
                {error}
              </p>
            )}

            {result && (
              <div className="flex flex-col gap-3 rounded-lg bg-tertiary-container p-4 text-on-tertiary-container">
                <span className="text-sm font-medium">Result preview</span>
                <ResultPreview
                  key={result.url}
                  url={result.url}
                  mimeType={result.mimeType}
                  fileName={result.fileName}
                />
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums">{formatBytes(result.originalBytes)}</span>
                  <ArrowRightIcon className="size-4" />
                  <span className="font-medium tabular-nums">
                    {formatBytes(result.resultBytes)}
                  </span>
                  <span className="ml-auto font-medium">{sizeLabel}</span>
                </div>
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
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>
                <XIcon /> Remove
              </Button>
              <Button type="submit" form="image-tool-form" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2Icon className="animate-spin" />}
                {mutation.isPending ? "Working…" : actionLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
