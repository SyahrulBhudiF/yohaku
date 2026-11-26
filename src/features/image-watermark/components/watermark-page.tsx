import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { DownloadIcon, FileImageIcon, ImageIcon, Loader2Icon, XIcon } from "lucide-react"
import { useState } from "react"

import { Dropzone } from "@/components/dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { InlineError } from "@/features/tools/components/inline-error"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_WATERMARK_LOGO_BYTES,
  MAX_WATERMARK_TEXT_CHARS,
  WATERMARK_FORMAT_EXTENSION,
  WATERMARK_POSITION_LABEL,
  WatermarkFormSchema,
  type WatermarkColor,
  type WatermarkFormat,
  type WatermarkFormValues,
  type WatermarkPosition,
} from "@/libs/schemas/watermark"
import { cn } from "@/libs/utils/cn"
import { formatBytes } from "@/libs/utils/format"
import { watermarkImage } from "../process"
import { useWatermarkStore } from "../store"

const POSITIONS: ReadonlyArray<WatermarkPosition> = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
]

const FORMAT_LABEL: Record<WatermarkFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
}

const positionAlignment = (position: WatermarkPosition) => {
  const vertical = position.includes("top")
    ? "items-start"
    : position.includes("bottom")
      ? "items-end"
      : "items-center"
  const horizontal = position.includes("left")
    ? "justify-start"
    : position.includes("right")
      ? "justify-end"
      : "justify-center"

  return cn("flex size-full p-1.5", vertical, horizontal)
}

export function WatermarkPage() {
  const {
    file,
    previewUrl,
    logo,
    logoPreviewUrl,
    result,
    setFile,
    setLogo,
    setResult,
    clearResult,
    reset,
  } = useWatermarkStore()
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: watermarkImage,
    onSuccess: (output, input) => {
      if (useWatermarkStore.getState().file === input.file) setResult(output)
    },
  })
  const form = useForm({
    defaultValues: {
      type: "text",
      text: "Yohaku",
      position: "bottom-right",
      opacity: 55,
      rotation: 0,
      size: 18,
      color: "white",
      format: "png",
      quality: 90,
    } as WatermarkFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(WatermarkFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        mutation.reset()
        setError(null)
      },
    },
    onSubmit: ({ value }) => {
      if (!file) return

      if (value.type === "text" && !value.text.trim()) {
        setError("Enter watermark text.")

        return
      }

      if (value.type === "logo" && !logo) {
        setError("Choose a logo image.")

        return
      }

      setError(null)
      mutation.mutate({ file, logo, options: value })
    },
  })
  const values = form.state.values
  const errorMessage = error ?? mutation.error?.message ?? null

  const handleSelect = (files: ReadonlyArray<File>) => {
    const next = files[0]

    if (!next) return

    mutation.reset()
    setError(null)
    setFile(next)
  }

  const handleRemove = () => {
    mutation.reset()
    setError(null)
    reset()
  }

  const handleLogo = (files: ReadonlyArray<File>) => {
    const next = files[0]

    if (!next) return

    mutation.reset()
    setError(null)
    setLogo(next)
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="image-watermark" japanese="画像の透かし">
        <h1 className="text-3xl font-normal tracking-tight">Add a watermark to an image</h1>
        <p className="text-muted-foreground">
          Place text or a logo on a PNG, JPEG, or WebP image. Everything runs in your browser.
        </p>
      </ToolPageHeader>

      {!file && (
        <Dropzone
          accept="image/png,image/jpeg,image/webp"
          hint="PNG, JPEG or WebP · up to 25 MB"
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
                disabled={mutation.isPending}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="checkerboard flex max-h-72 min-h-40 items-center justify-center overflow-hidden rounded-md">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview of the selected file"
                  className="max-h-72 w-full object-contain"
                />
              )}
            </div>

            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
            >
              <form.Field name="type">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Watermark</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={field.state.value === "text" ? "default" : "outline"}
                        onClick={() => field.handleChange("text")}
                      >
                        Text
                      </Button>
                      <Button
                        type="button"
                        variant={field.state.value === "logo" ? "default" : "outline"}
                        onClick={() => field.handleChange("logo")}
                      >
                        Logo
                      </Button>
                    </div>
                  </div>
                )}
              </form.Field>

              {values.type === "text" ? (
                <form.Field name="text">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="watermark-text" className="text-sm font-medium">
                        Text
                      </label>
                      <input
                        id="watermark-text"
                        value={field.state.value}
                        maxLength={MAX_WATERMARK_TEXT_CHARS}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Yohaku"
                        className="h-11 w-full rounded-xl border border-outline-variant bg-surface px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                    </div>
                  )}
                </form.Field>
              ) : logo && logoPreviewUrl ? (
                <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3">
                  <img
                    src={logoPreviewUrl}
                    alt=""
                    className="size-12 rounded-md bg-white object-contain ring-1 ring-outline-variant"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{logo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(logo.size)} · up to {MAX_WATERMARK_LOGO_BYTES / 1024 / 1024} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setLogo(null)}
                    aria-label="Remove logo"
                  >
                    <XIcon />
                  </Button>
                </div>
              ) : (
                <Dropzone
                  icon={ImageIcon}
                  accept="image/png,image/jpeg,image/webp"
                  compact
                  label="Choose a logo"
                  hint="PNG, JPEG or WebP · transparent PNG works best"
                  onFiles={handleLogo}
                />
              )}

              <form.Field name="position">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Position</span>
                    <div className="grid w-36 grid-cols-3 gap-1.5">
                      {POSITIONS.map((position) => {
                        const active = field.state.value === position

                        return (
                          <button
                            key={position}
                            type="button"
                            aria-label={WATERMARK_POSITION_LABEL[position]}
                            aria-pressed={active}
                            onClick={() => field.handleChange(position)}
                            className={cn(
                              "flex size-11 items-center justify-center rounded-md border transition-colors",
                              active
                                ? "border-primary bg-primary-container text-on-primary-container"
                                : "border-outline-variant text-muted-foreground hover:bg-surface-container",
                            )}
                          >
                            <span className={positionAlignment(position)}>
                              <span className="size-2 rounded-full bg-current" />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <Button
                      type="button"
                      variant={field.state.value === "tiled" ? "default" : "outline"}
                      className="w-36"
                      onClick={() => field.handleChange("tiled")}
                    >
                      Tiled
                    </Button>
                  </div>
                )}
              </form.Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <form.Field name="opacity">
                  {(field) => (
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      <span>Opacity · {field.state.value}%</span>
                      <Slider
                        aria-label="Watermark opacity"
                        min={5}
                        max={100}
                        step={1}
                        value={[field.state.value]}
                        onValueChange={(value) =>
                          field.handleChange(
                            Array.isArray(value) ? (value[0] ?? field.state.value) : value,
                          )
                        }
                      />
                    </label>
                  )}
                </form.Field>
                <form.Field name="rotation">
                  {(field) => (
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      <span>Rotation · {field.state.value}°</span>
                      <Slider
                        aria-label="Watermark rotation"
                        min={-90}
                        max={90}
                        step={1}
                        value={[field.state.value]}
                        onValueChange={(value) =>
                          field.handleChange(
                            Array.isArray(value) ? (value[0] ?? field.state.value) : value,
                          )
                        }
                      />
                    </label>
                  )}
                </form.Field>
                <form.Field name="size">
                  {(field) => (
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      <span>Size · {field.state.value}% of width</span>
                      <Slider
                        aria-label="Watermark size"
                        min={5}
                        max={60}
                        step={1}
                        value={[field.state.value]}
                        onValueChange={(value) =>
                          field.handleChange(
                            Array.isArray(value) ? (value[0] ?? field.state.value) : value,
                          )
                        }
                      />
                    </label>
                  )}
                </form.Field>
                <form.Field name="format">
                  {(field) => (
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      <span>Output format</span>
                      <select
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value as WatermarkFormat)
                        }
                        className="h-11 rounded-xl border border-outline-variant bg-surface px-4 text-sm"
                      >
                        {(["png", "jpeg", "webp"] as const).map((format) => (
                          <option key={format} value={format}>
                            {FORMAT_LABEL[format]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </form.Field>
                {values.type === "text" && (
                  <form.Field name="color">
                    {(field) => (
                      <label className="flex flex-col gap-2 text-sm font-medium">
                        <span>Text color</span>
                        <select
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value as WatermarkColor)
                          }
                          className="h-11 rounded-xl border border-outline-variant bg-surface px-4 text-sm"
                        >
                          <option value="white">White</option>
                          <option value="black">Black</option>
                        </select>
                      </label>
                    )}
                  </form.Field>
                )}
                {values.format !== "png" && (
                  <form.Field name="quality">
                    {(field) => (
                      <label className="flex flex-col gap-2 text-sm font-medium">
                        <span>Quality · {field.state.value}</span>
                        <Slider
                          aria-label="Output quality"
                          min={1}
                          max={100}
                          step={1}
                          value={[field.state.value]}
                          onValueChange={(value) =>
                            field.handleChange(
                              Array.isArray(value) ? (value[0] ?? field.state.value) : value,
                            )
                          }
                        />
                      </label>
                    )}
                  </form.Field>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>
                  {mutation.isPending ? <Loader2Icon className="animate-spin" /> : null}
                  {mutation.isPending ? "Adding watermark…" : "Add watermark"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {WATERMARK_FORMAT_EXTENSION[values.format].toUpperCase()} output ·{" "}
                  {values.position === "tiled"
                    ? "tiled"
                    : WATERMARK_POSITION_LABEL[values.position]}
                </span>
              </div>
              <InlineError>{errorMessage}</InlineError>
            </form>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card size="sm" className="bg-tertiary-container text-on-tertiary-container">
          <CardHeader>
            <CardTitle className="text-base">Watermarked image</CardTitle>
            <CardDescription className="text-on-tertiary-container/80">
              {result.width} × {result.height} · {formatBytes(result.inputBytes)} →{" "}
              {formatBytes(result.bytes)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="checkerboard flex max-h-96 min-h-40 items-center justify-center overflow-hidden rounded-md">
              <img
                src={result.url}
                alt="Watermarked result preview"
                className="max-h-96 w-full object-contain"
              />
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
          </CardContent>
        </Card>
      )}
    </main>
  )
}
