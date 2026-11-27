import { useForm } from "@tanstack/react-form"
import { Schema } from "effect"
import { FileImageIcon, Loader2Icon, ShapesIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dropzone } from "@/components/dropzone"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Checkerboard,
  ImageFileCard,
  ImageResultCard,
} from "@/features/image-tools/components/image-result-parts"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_SVG_SIDE,
  SvgToImageFormSchema,
  type SvgOutputFormat,
  type SvgToImageFormValues,
} from "@/libs/schemas/svg-to-image"
import { useSvgToImage } from "../use-svg-to-image"

const formatLabel = (format: SvgOutputFormat) => (format === "png" ? "PNG" : "WebP")

export function SvgToImagePage() {
  const model = useSvgToImage()
  const form = useForm({
    defaultValues: { format: "png", width: 1024, quality: 90 } as SvgToImageFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(SvgToImageFormSchema) },
    listeners: {
      onChange: () => {
        model.clearResult()
        model.convert.reset()
      },
    },
    onSubmit: ({ value }) => {
      if (!model.file) return

      model.convert.mutate({ file: model.file, ...value })
    },
  })
  const error = model.selectionError ?? model.convert.error?.message ?? null
  const pending = model.convert.isPending

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="svg-to-image" japanese="SVGから画像へ">
        <h1 className="text-3xl font-normal tracking-tight">SVG to PNG / WebP</h1>
        <p className="text-muted-foreground">
          Rasterize a self-contained SVG at a chosen width. External references are blocked, and
          nothing is uploaded.
        </p>
      </ToolPageHeader>

      {model.file === null ? (
        <Dropzone
          accept=".svg,image/svg+xml"
          icon={ShapesIcon}
          label="Drop an SVG here, or click to browse"
          hint={`SVG only · up to 5 MB · max ${MAX_SVG_SIDE} px wide`}
          onFiles={(files) => model.selectFile(files[0])}
        />
      ) : (
        <>
          <ImageFileCard
            file={model.file}
            previewUrl={model.previewUrl}
            disabled={pending}
            onRemove={model.clear}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Output</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                id="svg-to-image-form"
                className="grid gap-6 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit()
                }}
              >
                <form.Field name="format">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Format</span>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as SvgOutputFormat)}
                      >
                        <SelectTrigger className="w-full" aria-label="Output format">
                          <SelectValue>{formatLabel(field.state.value)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="webp">WebP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <form.Field name="width">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="svg-width" className="text-sm font-medium">
                        Width (px)
                      </label>
                      <Input
                        id="svg-width"
                        type="number"
                        min={16}
                        max={MAX_SVG_SIDE}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(Number(event.target.value))}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p role="alert" className="text-sm text-error">
                          Width must be between 16 and {MAX_SVG_SIDE} px.
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                {form.state.values.format === "webp" && (
                  <form.Field name="quality">
                    {(field) => (
                      <div className="flex flex-col gap-4 sm:col-span-2">
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
                          PNG keeps transparency and is lossless. WebP uses the quality setting and
                          supports transparency too.
                        </p>
                      </div>
                    )}
                  </form.Field>
                )}

                <p className="text-sm text-muted-foreground sm:col-span-2">
                  The height follows the SVG&apos;s aspect ratio. Large SVGs are capped at{" "}
                  {MAX_SVG_SIDE} px per side and 24 megapixels.
                </p>
              </form>
            </CardContent>
          </Card>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
            >
              {error}
            </p>
          )}

          {model.result && (
            <ImageResultCard
              result={model.result}
              title="Your image is ready"
              description={`${model.result.width}×${model.result.height} · ${formatLabel(form.state.values.format)}`}
            >
              <Checkerboard className="flex max-h-80 min-h-40 items-center justify-center">
                <img
                  src={model.result.url}
                  alt="Converted SVG preview"
                  className="max-h-80 w-full object-contain"
                />
              </Checkerboard>
            </ImageResultCard>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={model.clear} disabled={pending}>
              <XIcon /> Remove
            </Button>
            <Button type="submit" form="svg-to-image-form" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <FileImageIcon />}
              {pending ? "Converting…" : "Convert SVG"}
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
