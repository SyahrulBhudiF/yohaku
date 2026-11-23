import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { DownloadIcon, FileImageIcon, Loader2Icon, XIcon } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { IMAGE_FORMATS } from "@/libs/schemas/image"
import {
  MAX_PDF_BYTES,
  MAX_PDF_IMAGE_PAGES,
  PdfImageFormSchema,
  type PdfImageDpi,
  type PdfImageFormValues,
} from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { preloadImageCodec } from "@/libs/utils/image-codec"
import { isPreviewableImageMime } from "@/libs/utils/image-preview"
import { parsePageSelection } from "@/libs/utils/pdf/ranges"
import { preparePdfFile, renderPdfImages } from "../process"
import { newPdfId, usePdfToImageStore } from "../store"
import { disposePdfFile } from "../thumbnails"
import { isPdfFile } from "../validation"
import { PageThumbnail } from "./page-thumbnail"
import { PasswordPrompt } from "./password-prompt"
import { PdfDropzone } from "./pdf-dropzone"

interface PendingPassword {
  readonly id: string
  readonly file: File
  readonly message: string
}

const DPI_LABEL: Record<PdfImageDpi, string> = {
  72: "72 DPI · screen",
  150: "150 DPI · standard",
  300: "300 DPI · print",
}

export function PdfToImagePage() {
  const { file, result, setFile, setResult, clearResult, reset } = usePdfToImageStore()
  const render = useMutation({ mutationFn: renderPdfImages, onSuccess: setResult })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [pending, setPending] = useState<PendingPassword | null>(null)
  const [pageSelection, setPageSelection] = useState("")
  const form = useForm({
    defaultValues: {
      format: "png",
      quality: 90,
      dpi: 150,
    } as PdfImageFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(PdfImageFormSchema) },
    listeners: {
      onChange: () => {
        clearResult()
        render.reset()
        setError(null)
      },
    },
    onSubmit: async ({ value }) => {
      if (!file) {
        return
      }

      const parsed = parsePageSelection(pageSelection, file.pageCount)

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
      await render
        .mutateAsync({
          file,
          pages: parsed.pages,
          format: value.format,
          quality: value.quality,
          dpi: value.dpi,
        })
        .catch(() => null)
    },
  })
  const errorMessage = error ?? render.error?.message ?? null
  const selection = file ? parsePageSelection(pageSelection, file.pageCount) : null
  const selectedCount = selection?.ok ? selection.pages.length : 0
  const selectionError =
    selection && !selection.ok
      ? selection.message
      : selection && selection.pages.length > MAX_PDF_IMAGE_PAGES
        ? `Choose at most ${MAX_PDF_IMAGE_PAGES} pages per run.`
        : null

  const handleFile = async (incoming: ReadonlyArray<File>) => {
    const next = incoming[0]

    if (!next) {
      return
    }

    setError(null)
    setPending(null)
    render.reset()
    reset()
    form.reset()
    setPageSelection("")

    if (pending) {
      disposePdfFile(pending.id)
    }

    if (!isPdfFile(next)) {
      setError("Only PDF files can be converted.")

      return
    }

    if (next.size > MAX_PDF_BYTES) {
      setError(`PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`)

      return
    }

    setLoading(true)

    try {
      const id = newPdfId()
      const prepared = await preparePdfFile(id, next)

      if (!prepared.ok) {
        if (prepared.reason === "password") {
          setPending({ id, file: next, message: prepared.message })
        } else {
          disposePdfFile(id)
          setError(prepared.message)
        }

        return
      }

      setFile({
        id,
        file: next,
        name: next.name,
        size: next.size,
        pageCount: prepared.pageCount,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (password: string) => {
    if (!pending) {
      return
    }

    setUnlocking(true)
    setError(null)

    try {
      const prepared = await preparePdfFile(pending.id, pending.file, password)

      if (!prepared.ok) {
        setPending({ ...pending, message: prepared.message })

        return
      }

      setFile({
        id: pending.id,
        file: pending.file,
        name: pending.file.name,
        size: pending.file.size,
        pageCount: prepared.pageCount,
        password,
      })
      setPending(null)
      setPageSelection("")
    } finally {
      setUnlocking(false)
    }
  }

  const handleRemovePending = () => {
    if (pending) {
      disposePdfFile(pending.id)
    }

    setPending(null)
  }

  const handleReset = () => {
    render.reset()
    setError(null)

    if (pending) {
      disposePdfFile(pending.id)
    }

    setPending(null)
    form.reset()
    setPageSelection("")
    reset()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">PDF to image</h1>
        <p className="text-muted-foreground">
          Render every page as an image. Multiple images download together as a ZIP. Everything runs
          in your browser.
        </p>
      </div>

      {!file && !pending && (
        <PdfDropzone
          disabled={loading}
          onFiles={(incoming) => void handleFile(incoming)}
          hint={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
          label={loading ? "Reading PDF…" : undefined}
        />
      )}

      {pending && (
        <PasswordPrompt
          name={pending.file.name}
          size={pending.file.size}
          message={pending.message}
          busy={unlocking}
          onUnlock={(password) => void handleUnlock(password)}
          onRemove={handleRemovePending}
        />
      )}

      {file && (
        <>
          <Card size="sm">
            <CardContent className="flex items-center gap-4 pt-4">
              <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-outline-variant">
                <PageThumbnail
                  fileId={file.id}
                  file={file.file}
                  pageNumber={1}
                  password={file.password}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{file.name}</span>
                <span className="text-sm text-muted-foreground">
                  {file.pageCount} {file.pageCount === 1 ? "page" : "pages"} ·{" "}
                  {formatBytes(file.size)}
                </span>
                {file.password && (
                  <span className="text-xs text-muted-foreground">Password protected</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                disabled={render.isPending}
                aria-label={`Remove ${file.name}`}
              >
                <XIcon />
              </Button>
            </CardContent>
          </Card>

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
                      <SelectTrigger className="w-full">
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
                      <SelectTrigger className="w-full">
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

            <div className="flex flex-col gap-2">
              <label htmlFor="pdf-pages" className="text-sm font-medium">
                Pages
              </label>
              <Input
                id="pdf-pages"
                value={pageSelection}
                placeholder="All pages"
                aria-describedby="pdf-pages-hint"
                onChange={(event) => {
                  setPageSelection(event.target.value)
                  clearResult()
                  render.reset()
                  setError(null)
                }}
              />
              <p id="pdf-pages-hint" className="text-xs text-muted-foreground">
                Leave empty for all pages. Use ranges like 1-3, 5, 7-9; up to {MAX_PDF_IMAGE_PAGES}{" "}
                pages per run.
              </p>
              {selectionError && (
                <p role="alert" className="text-sm text-error">
                  {selectionError}
                </p>
              )}
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
                  {result.images} {result.images === 1 ? "image" : "images"} ready
                </CardTitle>
                <CardDescription className="text-on-tertiary-container/80">
                  {formatBytes(result.inputBytes)} → {formatBytes(result.bytes)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {result.previewUrl &&
                  result.previewMimeType &&
                  isPreviewableImageMime(result.previewMimeType) && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium">First selected page</span>
                      <img
                        src={result.previewUrl}
                        alt="First page preview"
                        className="max-h-64 w-full rounded-md bg-surface-container object-contain"
                      />
                    </div>
                  )}
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

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleReset} disabled={render.isPending}>
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
