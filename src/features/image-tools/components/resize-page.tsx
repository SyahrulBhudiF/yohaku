import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import {
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  Loader2Icon,
  LockIcon,
  UnlockIcon,
} from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { InlineError } from "@/features/tools/components/inline-error"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  IMAGE_FORMATS,
  ImageResizeFormSchema,
  MAX_IMAGE_PIXELS,
  MAX_RESIZE_SIDE,
  type ImageCropAspect,
  type ImageResizeFormat,
  type ImageResizeFormValues,
  type ImageResizeMode,
} from "@/libs/schemas/image"
import { preloadImageCodec } from "@/libs/utils/image-codec"
import { CROP_ASPECT, computeResizeGeometry, cropRectForAspect } from "@/libs/utils/image-resize"
import { prepareResizeFile, resizeImage, type ResizeFileInfo } from "../resize-process"
import { useResizeStore } from "../store"
import { Dropzone } from "./dropzone"
import { ImageCropEditor } from "./image-crop-editor"
import { Checkerboard, ImageFileCard, ImageResultCard } from "./image-result-parts"

const MODE_LABEL: Record<ImageResizeMode, string> = {
  fit: "Fit inside",
  fill: "Fill & crop",
  stretch: "Stretch",
}

const CROP_LABEL: Record<ImageCropAspect, string> = {
  free: "Free",
  "1:1": "Square (1:1)",
  "4:3": "4:3",
  "3:2": "3:2",
  "16:9": "16:9",
  "9:16": "9:16",
}

const ROTATE_LABEL: Record<0 | 90 | 180 | 270, string> = {
  0: "0°",
  90: "90°",
  180: "180°",
  270: "270°",
}

const FORMAT_LABEL: Record<ImageResizeFormat, string> = {
  original: "Keep original",
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  avif: "AVIF",
  gif: "GIF",
  tiff: "TIFF",
}

const FORMATS: ReadonlyArray<ImageResizeFormat> = ["original", ...IMAGE_FORMATS]

export function ResizePage() {
  const { file, previewUrl, result, setFile, setResult, clearResult, reset } = useResizeStore()
  const [source, setSource] = useState<ResizeFileInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selection = useRef(0)
  const resize = useMutation({
    mutationFn: resizeImage,
    onSuccess: (output, input) => {
      if (useResizeStore.getState().file === input.file) setResult(output)
    },
  })
  const form = useForm({
    defaultValues: {
      width: 1,
      height: 1,
      lockAspect: true,
      mode: "fit",
      crop: { x: 0, y: 0, width: 1, height: 1 },
      cropAspect: "free",
      rotate: 0,
      flipX: false,
      flipY: false,
      format: "original",
      quality: 90,
    } as ImageResizeFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(ImageResizeFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        resize.reset()
        setError(null)
      },
    },
    onSubmit: ({ value }) => {
      if (!file || !source) return

      const output = computeResizeGeometry(source.width, source.height, {
        width: value.width,
        height: value.height,
        mode: value.mode,
        crop: value.crop,
        rotate: value.rotate,
        flipX: value.flipX,
        flipY: value.flipY,
      })

      if (output.outputWidth * output.outputHeight > MAX_IMAGE_PIXELS) {
        setError(`Keep the output under ${MAX_IMAGE_PIXELS / 1_000_000} megapixels.`)

        return
      }

      setError(null)
      resize.mutate({
        file,
        options: {
          width: value.width,
          height: value.height,
          mode: value.mode,
          crop: value.crop,
          rotate: value.rotate,
          flipX: value.flipX,
          flipY: value.flipY,
        },
        format: value.format,
        quality: value.quality,
      })
    },
  })
  const prepare = useMutation({ mutationFn: prepareResizeFile })
  const values = form.state.values
  const sourceAspect = source ? source.width / source.height : 1
  const cropPixelAspect = source
    ? (values.crop.width * source.width) / (values.crop.height * source.height)
    : sourceAspect
  const geometry = source
    ? computeResizeGeometry(source.width, source.height, {
        width: values.width,
        height: values.height,
        mode: values.mode,
        crop: values.crop,
        rotate: values.rotate,
        flipX: values.flipX,
        flipY: values.flipY,
      })
    : null
  const outputPixels = geometry ? geometry.outputWidth * geometry.outputHeight : 0
  const tooLarge = outputPixels > MAX_IMAGE_PIXELS
  const errorMessage = error ?? prepare.error?.message ?? resize.error?.message ?? null

  const handleSelect = (incoming: ReadonlyArray<File>) => {
    const next = incoming[0]

    if (!next) return

    prepare.reset()
    resize.reset()
    setError(null)
    setSource(null)
    reset()

    const id = selection.current + 1

    selection.current = id
    prepare.mutate(next, {
      onSuccess: (prepared) => {
        if (selection.current !== id) return

        if (!prepared.ok) {
          setError(prepared.message)

          return
        }

        setSource(prepared.info)
        setFile(prepared.info.file)
        form.reset()
        form.setFieldValue("width", prepared.info.width)
        form.setFieldValue("height", prepared.info.height)
      },
    })
  }

  const handleRemove = () => {
    selection.current += 1
    prepare.reset()
    resize.reset()
    setError(null)
    setSource(null)
    reset()
  }

  const updateWidth = (value: number) => {
    form.setFieldValue("width", value)

    if (values.lockAspect && Number.isFinite(value) && value > 0) {
      form.setFieldValue(
        "height",
        Math.max(1, Math.min(MAX_RESIZE_SIDE, Math.round(value / cropPixelAspect))),
      )
    }
  }

  const updateHeight = (value: number) => {
    form.setFieldValue("height", value)

    if (values.lockAspect && Number.isFinite(value) && value > 0) {
      form.setFieldValue(
        "width",
        Math.max(1, Math.min(MAX_RESIZE_SIDE, Math.round(value * cropPixelAspect))),
      )
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="image-resize" japanese="画像のリサイズ">
        <h1 className="text-3xl font-normal tracking-tight">Resize image</h1>
        <p className="text-muted-foreground">
          Change dimensions, crop, rotate, or flip an image. Everything runs in your browser.
        </p>
      </ToolPageHeader>

      {!file && (
        <>
          <Dropzone
            disabled={prepare.isPending}
            onFiles={handleSelect}
            {...(prepare.isPending ? { label: "Reading image…" } : {})}
          />
          <InlineError>{errorMessage}</InlineError>
        </>
      )}

      {file && (
        <>
          <ImageFileCard
            file={file}
            previewUrl={previewUrl}
            disabled={resize.isPending}
            onRemove={handleRemove}
            showPreview={false}
          />

          <form
            id="resize-form"
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            {source && previewUrl && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Crop</span>
                  <span className="text-xs text-muted-foreground">Drag the box or a handle</span>
                </div>
                <form.Field name="crop">
                  {(field) => (
                    <ImageCropEditor
                      src={previewUrl}
                      sourceWidth={source.width}
                      sourceHeight={source.height}
                      crop={field.state.value}
                      aspect={CROP_ASPECT[values.cropAspect]}
                      disabled={resize.isPending}
                      onChange={(next) => {
                        form.setFieldValue("crop", next)

                        if (values.lockAspect && values.width > 0) {
                          const aspect = (next.width * source.width) / (next.height * source.height)

                          form.setFieldValue(
                            "height",
                            Math.max(
                              1,
                              Math.min(MAX_RESIZE_SIDE, Math.round(values.width / aspect)),
                            ),
                          )
                        }
                      }}
                    />
                  )}
                </form.Field>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <form.Field name="width">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="resize-width" className="text-sm font-medium">
                      Width
                    </label>
                    <Input
                      id="resize-width"
                      type="number"
                      min={1}
                      max={MAX_RESIZE_SIDE}
                      value={field.state.value}
                      onChange={(event) => updateWidth(Number(event.target.value))}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p role="alert" className="text-sm text-error">
                        Width must be between 1 and {MAX_RESIZE_SIDE}.
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="height">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="resize-height" className="text-sm font-medium">
                      Height
                    </label>
                    <Input
                      id="resize-height"
                      type="number"
                      min={1}
                      max={MAX_RESIZE_SIDE}
                      value={field.state.value}
                      onChange={(event) => updateHeight(Number(event.target.value))}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p role="alert" className="text-sm text-error">
                        Height must be between 1 and {MAX_RESIZE_SIDE}.
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={values.lockAspect ? "secondary" : "outline"}
                aria-pressed={values.lockAspect}
                onClick={() => {
                  const next = !values.lockAspect

                  form.setFieldValue("lockAspect", next)

                  if (next && values.width > 0) {
                    form.setFieldValue(
                      "height",
                      Math.max(
                        1,
                        Math.min(MAX_RESIZE_SIDE, Math.round(values.width / cropPixelAspect)),
                      ),
                    )
                  }
                }}
              >
                {values.lockAspect ? <LockIcon /> : <UnlockIcon />}
                Lock aspect
              </Button>
              <Button
                type="button"
                variant={values.flipX ? "secondary" : "outline"}
                aria-pressed={values.flipX}
                onClick={() => form.setFieldValue("flipX", !values.flipX)}
              >
                <FlipHorizontal2Icon /> Flip horizontal
              </Button>
              <Button
                type="button"
                variant={values.flipY ? "secondary" : "outline"}
                aria-pressed={values.flipY}
                onClick={() => form.setFieldValue("flipY", !values.flipY)}
              >
                <FlipVertical2Icon /> Flip vertical
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <form.Field name="mode">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Resize mode</span>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as ImageResizeMode)}
                    >
                      <SelectTrigger className="w-full" aria-label="Resize mode">
                        <SelectValue>{MODE_LABEL[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fit">Fit inside</SelectItem>
                        <SelectItem value="fill">Fill &amp; crop</SelectItem>
                        <SelectItem value="stretch">Stretch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              <form.Field name="cropAspect">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Crop aspect</span>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        const next = value as ImageCropAspect

                        field.handleChange(next)

                        if (source && next !== "free") {
                          const aspect = CROP_ASPECT[next]!

                          form.setFieldValue(
                            "crop",
                            cropRectForAspect(aspect, source.width, source.height),
                          )

                          if (values.lockAspect && values.width > 0) {
                            form.setFieldValue(
                              "height",
                              Math.max(
                                1,
                                Math.min(MAX_RESIZE_SIDE, Math.round(values.width / aspect)),
                              ),
                            )
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label="Crop aspect">
                        <SelectValue>{CROP_LABEL[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="1:1">Square (1:1)</SelectItem>
                        <SelectItem value="4:3">4:3</SelectItem>
                        <SelectItem value="3:2">3:2</SelectItem>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <form.Field name="rotate">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Rotate</span>
                    <Select
                      value={String(field.state.value)}
                      onValueChange={(value) =>
                        field.handleChange(Number(value) as 0 | 90 | 180 | 270)
                      }
                    >
                      <SelectTrigger className="w-full" aria-label="Rotate">
                        <SelectValue>{ROTATE_LABEL[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0°</SelectItem>
                        <SelectItem value="90">90°</SelectItem>
                        <SelectItem value="180">180°</SelectItem>
                        <SelectItem value="270">270°</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              <form.Field name="format">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Output format</span>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        const format = value as ImageResizeFormat

                        field.handleChange(format)

                        if (format !== "original") {
                          preloadImageCodec(format)
                        }
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label="Output format">
                        <SelectValue>{FORMAT_LABEL[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((format) => (
                          <SelectItem key={format} value={format}>
                            {FORMAT_LABEL[format]}
                          </SelectItem>
                        ))}
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
                    Quality
                    <span className="text-muted-foreground tabular-nums">{field.state.value}</span>
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
                    Quality applies to JPEG, WebP, AVIF, and GIF. PNG and TIFF are lossless.
                  </p>
                </div>
              )}
            </form.Field>

            {source && geometry && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3 text-sm">
                <span className="font-medium">
                  {source.width}×{source.height} → {geometry.outputWidth}×{geometry.outputHeight}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {geometry.outputWidth * geometry.outputHeight} px
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Animated GIF and WebP inputs use the first frame. Output is capped at{" "}
              {MAX_IMAGE_PIXELS / 1_000_000} megapixels.
            </p>

            {tooLarge && (
              <InlineError>
                Keep the output under {MAX_IMAGE_PIXELS / 1_000_000} megapixels.
              </InlineError>
            )}
            {!tooLarge && <InlineError>{errorMessage}</InlineError>}

            {result && (
              <ImageResultCard
                result={result}
                title="Resized image ready"
                description={`${source?.width ?? result.width}×${source?.height ?? result.height} → ${result.width}×${result.height}`}
              >
                <Checkerboard className="flex max-h-72 min-h-40 items-center justify-center">
                  <img
                    src={result.url}
                    alt={`Resized preview of ${result.fileName}`}
                    className="max-h-72 w-full object-contain"
                  />
                </Checkerboard>
              </ImageResultCard>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={resize.isPending || prepare.isPending || tooLarge}>
                {resize.isPending && <Loader2Icon className="animate-spin" />}
                {resize.isPending ? "Resizing…" : "Resize image"}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
