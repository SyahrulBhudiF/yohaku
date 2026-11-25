import { useForm } from "@tanstack/react-form"
import { HashIcon, Loader2Icon, StampIcon } from "lucide-react"
import { Schema } from "effect"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { PdfDropzone } from "@/features/pdf-tools/components/pdf-dropzone"
import { PdfFileCard } from "@/features/pdf-tools/components/pdf-file-card"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  PdfAnnotateFormSchema,
  type PdfAnnotateFormValues,
  type PdfNumberFormat,
  type PdfNumberPosition,
} from "@/libs/schemas/pdf"
import { parsePageSelection } from "@/libs/utils/pdf/ranges"
import { usePdfAnnotate } from "../use-pdf-annotate"
import { LogoPicker } from "./logo-picker"

const NUMBER_FORMAT_LABEL: Record<PdfNumberFormat, string> = {
  number: "1",
  "page-number": "Page 1",
  "number-total": "1 / N",
}

const NUMBER_POSITION_LABEL: Record<PdfNumberPosition, string> = {
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "middle-left": "Middle left",
  "middle-center": "Middle center",
  "middle-right": "Middle right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
}

const DEFAULT_VALUES: PdfAnnotateFormValues = {
  mode: "numbers",
  pageSelection: "",
  numberStart: 1,
  skipFirstPage: false,
  numberFormat: "number",
  numberPosition: "bottom-center",
  numberFontSize: 12,
  numberMargin: 24,
  watermarkKind: "text",
  watermarkText: "DRAFT",
  watermarkPlacement: "single",
  watermarkOpacity: 15,
  watermarkRotation: -45,
  watermarkFontSize: 64,
  watermarkScale: 35,
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)

          onChange(Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : min)
        }}
      />
    </label>
  )
}

export function PdfAnnotatePage() {
  const model = usePdfAnnotate()
  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onChange: Schema.toStandardSchemaV1(PdfAnnotateFormSchema) },
    listeners: {
      onChange: () => {
        model.clearResult()
        model.setError(null)
        model.annotate.reset()
      },
    },
    onSubmit: ({ value }) => {
      if (!model.file) {
        return
      }

      if (
        value.mode === "watermark" &&
        value.watermarkKind === "text" &&
        !value.watermarkText.trim()
      ) {
        model.setError("Enter watermark text.")

        return
      }

      if (value.mode === "watermark" && value.watermarkKind === "image" && !model.logo) {
        model.setError("Choose a PNG or JPEG watermark image.")

        return
      }

      const selection = parsePageSelection(value.pageSelection, model.file.pageCount)

      if (!selection.ok) {
        model.setError(selection.message)

        return
      }

      model.setError(null)
      model.annotate.mutate({
        file: model.file.file,
        pageCount: model.file.pageCount,
        values: value,
        logo: model.logo,
      })
    },
  })

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-annotate" japanese="PDFにページ番号・透かし">
        <h1 className="text-3xl font-normal tracking-tight">Page numbers &amp; watermark</h1>
        <p className="text-muted-foreground">
          Stamp page numbers or a text or logo watermark on selected pages. Everything stays in your
          browser.
        </p>
      </ToolPageHeader>

      {!model.file ? (
        <PdfDropzone
          disabled={model.isReading}
          label={model.isReading ? "Reading PDF…" : undefined}
          onFiles={(files) => model.selectFile(files[0])}
        />
      ) : (
        <PdfFileCard file={model.file} onRemove={model.removeFile} disabled={model.isAnnotating} />
      )}

      {model.error && (
        <p
          role="alert"
          className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {model.error}
        </p>
      )}

      {model.file && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Annotation</CardTitle>
              <CardDescription>
                Choose what to add, then apply it to the selected pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="pdf-annotate-form"
                className="flex flex-col gap-6"
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit()
                }}
              >
                <form.Field name="mode">
                  {(field) => (
                    <fieldset className="min-w-0">
                      <legend className="sr-only">Annotation type</legend>
                      <div className="inline-flex self-start rounded-md bg-surface-container p-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={field.state.value === "numbers" ? "secondary" : "ghost"}
                          aria-pressed={field.state.value === "numbers"}
                          onClick={() => field.handleChange("numbers")}
                        >
                          <HashIcon /> Page numbers
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={field.state.value === "watermark" ? "secondary" : "ghost"}
                          aria-pressed={field.state.value === "watermark"}
                          onClick={() => field.handleChange("watermark")}
                        >
                          <StampIcon /> Watermark
                        </Button>
                      </div>
                    </fieldset>
                  )}
                </form.Field>

                <form.Field name="pageSelection">
                  {(field) => (
                    <label
                      htmlFor="pdf-annotate-pages"
                      className="flex flex-col gap-2 text-sm font-medium"
                    >
                      Pages
                      <Input
                        id="pdf-annotate-pages"
                        value={field.state.value}
                        placeholder="All pages"
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      <span className="text-xs font-normal text-muted-foreground">
                        Leave empty for all pages. Use ranges like 1-3, 5.
                      </span>
                    </label>
                  )}
                </form.Field>

                {form.state.values.mode === "numbers" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field name="numberStart">
                      {(field) => (
                        <NumberField
                          label="Start at"
                          value={field.state.value}
                          min={1}
                          max={9999}
                          onChange={field.handleChange}
                        />
                      )}
                    </form.Field>
                    <form.Field name="numberFormat">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium">Format</span>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value as PdfNumberFormat)}
                          >
                            <SelectTrigger className="w-full" aria-label="Number format">
                              <SelectValue>{NUMBER_FORMAT_LABEL[field.state.value]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(NUMBER_FORMAT_LABEL).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="numberPosition">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium">Position</span>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) =>
                              field.handleChange(value as PdfNumberPosition)
                            }
                          >
                            <SelectTrigger className="w-full" aria-label="Number position">
                              <SelectValue>{NUMBER_POSITION_LABEL[field.state.value]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(NUMBER_POSITION_LABEL).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="numberFontSize">
                      {(field) => (
                        <NumberField
                          label="Font size"
                          value={field.state.value}
                          min={8}
                          max={72}
                          onChange={field.handleChange}
                        />
                      )}
                    </form.Field>
                    <form.Field name="numberMargin">
                      {(field) => (
                        <NumberField
                          label="Margin (pt)"
                          value={field.state.value}
                          min={0}
                          max={144}
                          onChange={field.handleChange}
                        />
                      )}
                    </form.Field>
                    <form.Field name="skipFirstPage">
                      {(field) => (
                        <label className="flex items-center gap-2 self-end pb-2 text-sm">
                          <input
                            type="checkbox"
                            checked={field.state.value}
                            onChange={(event) => field.handleChange(event.target.checked)}
                            className="size-4 accent-primary"
                          />
                          Skip the first page
                        </label>
                      )}
                    </form.Field>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <form.Field name="watermarkKind">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium">Watermark type</span>
                          <fieldset className="min-w-0">
                            <legend className="sr-only">Watermark type</legend>
                            <div className="inline-flex self-start rounded-md bg-surface-container p-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={field.state.value === "text" ? "secondary" : "ghost"}
                                aria-pressed={field.state.value === "text"}
                                onClick={() => field.handleChange("text")}
                              >
                                Text
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={field.state.value === "image" ? "secondary" : "ghost"}
                                aria-pressed={field.state.value === "image"}
                                onClick={() => field.handleChange("image")}
                              >
                                Logo
                              </Button>
                            </div>
                          </fieldset>
                        </div>
                      )}
                    </form.Field>

                    {form.state.values.watermarkKind === "text" ? (
                      <form.Field name="watermarkText">
                        {(field) => (
                          <label
                            htmlFor="pdf-annotate-watermark-text"
                            className="flex flex-col gap-2 text-sm font-medium"
                          >
                            Text
                            <Input
                              id="pdf-annotate-watermark-text"
                              value={field.state.value}
                              maxLength={200}
                              onChange={(event) => field.handleChange(event.target.value)}
                            />
                          </label>
                        )}
                      </form.Field>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Logo</span>
                        <LogoPicker
                          logo={model.logo}
                          previewUrl={model.logoUrl}
                          onSelect={model.selectLogo}
                          onRemove={model.removeLogo}
                        />
                      </div>
                    )}

                    <form.Field name="watermarkPlacement">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium">Placement</span>
                          <fieldset className="min-w-0">
                            <legend className="sr-only">Watermark placement</legend>
                            <div className="inline-flex self-start rounded-md bg-surface-container p-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={field.state.value === "single" ? "secondary" : "ghost"}
                                aria-pressed={field.state.value === "single"}
                                onClick={() => field.handleChange("single")}
                              >
                                Single
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={field.state.value === "tiled" ? "secondary" : "ghost"}
                                aria-pressed={field.state.value === "tiled"}
                                onClick={() => field.handleChange("tiled")}
                              >
                                Tiled
                              </Button>
                            </div>
                          </fieldset>
                        </div>
                      )}
                    </form.Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <form.Field name="watermarkOpacity">
                        {(field) => (
                          <div className="flex flex-col gap-3">
                            <span className="flex justify-between text-sm font-medium">
                              Opacity{" "}
                              <span className="text-muted-foreground">{field.state.value}%</span>
                            </span>
                            <Slider
                              min={5}
                              max={100}
                              value={[field.state.value]}
                              aria-label="Watermark opacity"
                              onValueChange={(value) =>
                                field.handleChange(Array.isArray(value) ? (value[0] ?? 5) : value)
                              }
                            />
                          </div>
                        )}
                      </form.Field>
                      <form.Field name="watermarkRotation">
                        {(field) => (
                          <div className="flex flex-col gap-3">
                            <span className="flex justify-between text-sm font-medium">
                              Rotation{" "}
                              <span className="text-muted-foreground">{field.state.value}°</span>
                            </span>
                            <Slider
                              min={-180}
                              max={180}
                              value={[field.state.value]}
                              aria-label="Watermark rotation"
                              onValueChange={(value) =>
                                field.handleChange(Array.isArray(value) ? (value[0] ?? 0) : value)
                              }
                            />
                          </div>
                        )}
                      </form.Field>
                      {form.state.values.watermarkKind === "text" ? (
                        <form.Field name="watermarkFontSize">
                          {(field) => (
                            <div className="flex flex-col gap-3">
                              <span className="flex justify-between text-sm font-medium">
                                Size{" "}
                                <span className="text-muted-foreground">
                                  {field.state.value} pt
                                </span>
                              </span>
                              <Slider
                                min={12}
                                max={200}
                                value={[field.state.value]}
                                aria-label="Watermark text size"
                                onValueChange={(value) =>
                                  field.handleChange(
                                    Array.isArray(value) ? (value[0] ?? 12) : value,
                                  )
                                }
                              />
                            </div>
                          )}
                        </form.Field>
                      ) : (
                        <form.Field name="watermarkScale">
                          {(field) => (
                            <div className="flex flex-col gap-3">
                              <span className="flex justify-between text-sm font-medium">
                                Scale{" "}
                                <span className="text-muted-foreground">{field.state.value}%</span>
                              </span>
                              <Slider
                                min={5}
                                max={100}
                                value={[field.state.value]}
                                aria-label="Watermark scale"
                                onValueChange={(value) =>
                                  field.handleChange(Array.isArray(value) ? (value[0] ?? 5) : value)
                                }
                              />
                            </div>
                          )}
                        </form.Field>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              onClick={() => void form.handleSubmit()}
              disabled={model.isAnnotating}
            >
              {model.isAnnotating ? <Loader2Icon className="animate-spin" /> : <StampIcon />}
              {model.isAnnotating
                ? "Applying…"
                : form.state.values.mode === "numbers"
                  ? "Add page numbers"
                  : "Add watermark"}
            </Button>
          </div>

          {model.result && (
            <ConversionResult
              url={model.result.url}
              fileName={model.result.fileName}
              inputBytes={model.result.inputBytes}
              outputBytes={model.result.outputBytes}
              detail={`${model.result.pages} pages annotated`}
            />
          )}

          <p className="text-xs text-muted-foreground">
            Annotations rewrite the PDF, so existing digital signatures may be invalidated.
            Password-protected PDFs are not supported; unlock them first.
          </p>
        </>
      )}
    </main>
  )
}
