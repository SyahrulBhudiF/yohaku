import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { ArrowRightIcon, DownloadIcon, Loader2Icon, XIcon } from "lucide-react"
import { useEffect } from "react"

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
import {
  IMAGE_FORMATS,
  ImageToolFormSchema,
  type ImageFormat,
  type ImageToolFormValues,
} from "@/libs/schemas/image"
import { preloadImageCodec } from "@/libs/utils/image-codec"
import { formatBytes } from "@/libs/utils/format"
import { processImage, type ImageToolMode } from "../process"
import type { ImageToolStore } from "../store"
import { Dropzone } from "./dropzone"

interface ImageToolProps {
  readonly mode: ImageToolMode
  readonly useStore: ImageToolStore
  readonly title: string
  readonly description: string
  readonly allowOriginalFormat: boolean
  readonly actionLabel: string
}

const isImageFormat = Schema.is(Schema.Literals(IMAGE_FORMATS))

const toChoice = (value: string | null): ImageToolFormValues["format"] | null => {
  if (value === "original") {
    return value
  }

  return value !== null && isImageFormat(value) ? value : null
}

export function ImageTool({
  mode,
  useStore,
  title,
  description,
  allowOriginalFormat,
  actionLabel,
}: ImageToolProps) {
  const { file, previewUrl, result, setFile, setResult, clearResult } = useStore()
  const mutation = useMutation({
    mutationFn: processImage,
    onSuccess: setResult,
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
    onSubmit: async ({ value }) => {
      if (!file) {
        return
      }

      const format: ImageFormat | undefined = value.format === "original" ? undefined : value.format

      await mutation.mutateAsync({ mode, file, format, quality: value.quality }).catch(() => null)
    },
  })
  const preload = (choice: ImageToolFormValues["format"]) => {
    if (choice !== "original") {
      preloadImageCodec(choice)
    }
  }

  useEffect(() => {
    preload(allowOriginalFormat ? "original" : "webp")
  }, [allowOriginalFormat])

  const saved = result ? Math.round((1 - result.resultBytes / result.originalBytes) * 100) : 0
  const error = mutation.error?.message ?? null
  const reset = () => {
    mutation.reset()
    setFile(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {file === null ? (
        <Dropzone onFile={setFile} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="truncate text-base">{file.name}</CardTitle>
            <CardDescription>{formatBytes(file.size)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Selected file preview"
                className="max-h-72 w-full rounded-md bg-surface-container object-contain"
              />
            )}

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
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowOriginalFormat && (
                          <SelectItem value="original">Keep original</SelectItem>
                        )}
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
                      GIF palette.
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
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums">{formatBytes(result.originalBytes)}</span>
                  <ArrowRightIcon className="size-4" />
                  <span className="font-medium tabular-nums">
                    {formatBytes(result.resultBytes)}
                  </span>
                  <span className="ml-auto font-medium">
                    {saved >= 0 ? `${saved}% smaller` : `${-saved}% larger`}
                  </span>
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
