import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { FileImageIcon, Loader2Icon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { InlineError } from "@/features/tools/components/inline-error"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { IMAGE_FORMATS } from "@/libs/schemas/image"
import {
  MAX_PDF_BYTES,
  MAX_PDF_IMAGE_PAGES,
  PdfImageFormSchema,
  type PdfImageDpi,
  type PdfImageFormValues,
} from "@/libs/schemas/pdf"
import { preloadImageCodec } from "@/libs/utils/image-codec"
import { isPreviewableImageMime } from "@/libs/utils/image-preview"
import { parsePageSelection } from "@/libs/utils/pdf/ranges"
import { renderPdfImages } from "../process"
import { usePdfToImageStore } from "../store"
import { usePdfFile } from "../use-pdf-file"
import { PasswordPrompt } from "./password-prompt"
import { PdfDropzone } from "./pdf-dropzone"
import { PdfFileCard } from "./pdf-file-card"

const DPI_LABEL: Record<PdfImageDpi, string> = {
  72: "72 DPI · screen",
  150: "150 DPI · standard",
  300: "300 DPI · print",
}

export function PdfToImagePage() {
  const { file, result, setFile, setResult, clearResult, reset } = usePdfToImageStore()
  const render = useMutation({
    mutationFn: renderPdfImages,
    onSuccess: setResult,
  })
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      format: "png",
      quality: 90,
      dpi: 150,
      pageSelection: "",
    } as PdfImageFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(PdfImageFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        render.reset()
        setError(null)
      },
    },
    onSubmit: ({ value }) => {
      if (!file) {
        return
      }

      const parsed = parsePageSelection(value.pageSelection, file.pageCount)

      if (!parsed.ok) {
        setError(parsed.message)

        return
      }

      if (parsed.pages.length === 0) {
        setError("Choose at least one page.")

        return
      }

      if (parsed.pages.length > MAX_PDF_IMAGE_PAGES) {
        setError(`Choose at most ${MAX_PDF_IMAGE_PAGES} pages per run.`)

        return
      }

      setError(null)
      render.mutate({
        file,
        pages: parsed.pages,
        format: value.format,
        quality: value.quality,
        dpi: value.dpi,
      })
    },
  })
  const pdf = usePdfFile({
    setFile,
    reset,
    invalidMessage: "Only PDF files can be converted.",
    onReset: () => {
      form.reset()
      setError(null)
    },
    onSelected: (entry) => {
      form.setFieldValue("pageSelection", entry.pageCount === 1 ? "1" : `1-${entry.pageCount}`)
    },
  })
  const values = form.state.values
  const errorMessage = error ?? pdf.error ?? render.error?.message ?? null
  const selection = file ? parsePageSelection(values.pageSelection, file.pageCount) : null
  const selectedCount = selection?.ok ? selection.pages.length : 0
  const selectionError =
    selection && !selection.ok
      ? selection.message
      : selection && selection.pages.length > MAX_PDF_IMAGE_PAGES
        ? `Choose at most ${MAX_PDF_IMAGE_PAGES} pages per run.`
        : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-to-image" japanese="PDFを画像に変換">
        <h1 className="text-3xl font-normal tracking-tight">PDF to image</h1>
        <p className="text-muted-foreground">
          Render every page as an image. Multiple images download together as a ZIP. Everything runs
          in your browser.
        </p>
      </ToolPageHeader>

      {!file && !pdf.pending && (
        <PdfDropzone
          disabled={pdf.isReading}
          onFiles={(incoming) => void pdf.select(incoming)}
          hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
          label={pdf.isReading ? "Reading PDF…" : undefined}
        />
      )}

      {pdf.pending && (
        <PasswordPrompt
          name={pdf.pending.file.name}
          size={pdf.pending.file.size}
          message={pdf.pending.message}
          busy={pdf.isUnlocking}
          onUnlock={(password) => void pdf.unlock(password)}
          onRemove={pdf.remove}
        />
      )}

      {file && (
        <>
          <PdfFileCard file={file} onRemove={pdf.remove} disabled={render.isPending} />
          <form
            id="pdf-to-image-form"
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
                    <span className="text-sm font-medium">Image format</span>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        const choice = value as PdfImageFormValues["format"]

                        field.handleChange(choice)

                        if (choice !== "png" && choice !== "jpeg") {
                          preloadImageCodec(choice)
                        }
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label="Image format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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

              <form.Field name="dpi">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Resolution</span>
                    <Select
                      value={String(field.state.value)}
                      onValueChange={(value) => field.handleChange(Number(value) as PdfImageDpi)}
                    >
                      <SelectTrigger className="w-full" aria-label="Resolution">
                        <SelectValue>{DPI_LABEL[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="72">72 DPI · screen</SelectItem>
                        <SelectItem value="150">150 DPI · standard</SelectItem>
                        <SelectItem value="300">300 DPI · print</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="pageSelection">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="pdf-pages" className="text-sm font-medium">
                    Pages
                  </label>
                  <Input
                    id="pdf-pages"
                    value={field.state.value}
                    placeholder="All pages"
                    aria-describedby="pdf-pages-hint"
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <p id="pdf-pages-hint" className="text-xs text-muted-foreground">
                    Leave empty for all pages. Use ranges like 1-3, 5, 7-9; up to{" "}
                    {MAX_PDF_IMAGE_PAGES} pages per run.
                  </p>
                  {selectionError && (
                    <p role="alert" className="text-sm text-error">
                      {selectionError}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

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
                    PNG and TIFF are lossless. Quality drives JPEG, WebP, AVIF and the GIF palette.
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
              <FileImageIcon className="size-4" />
              {selectedCount} {selectedCount === 1 ? "image" : "images"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {selectedCount === 0
                ? "Choose pages"
                : selectedCount === 1
                  ? "Downloads as one image"
                  : "Downloads as a ZIP"}
            </span>
          </div>

          <InlineError>{errorMessage}</InlineError>

          {result && (
            <ConversionResult
              url={result.url}
              fileName={result.fileName}
              inputBytes={result.inputBytes}
              outputBytes={result.bytes}
              detail={`${result.images} ${result.images === 1 ? "image" : "images"}`}
            >
              {result.previewUrl &&
                result.previewMimeType &&
                isPreviewableImageMime(result.previewMimeType) && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <span className="text-xs font-medium">First selected page</span>
                    <img
                      src={result.previewUrl}
                      alt="First page preview"
                      className="max-h-64 w-full rounded-md bg-surface-container object-contain"
                    />
                  </div>
                )}
            </ConversionResult>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={pdf.remove} disabled={render.isPending}>
              <XIcon /> Remove PDF
            </Button>
            <Button
              type="submit"
              form="pdf-to-image-form"
              disabled={render.isPending || selectionError !== null || selectedCount === 0}
            >
              {render.isPending && <Loader2Icon className="animate-spin" />}
              {render.isPending
                ? "Rendering…"
                : selectedCount === 0
                  ? "Choose pages"
                  : `Convert to ${selectedCount} ${selectedCount === 1 ? "image" : "images"}`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
