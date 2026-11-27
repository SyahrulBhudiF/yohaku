import { useForm } from "@tanstack/react-form"
import { Schema } from "effect"
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { Button } from "@/components/ui/button"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  ImageOcrFormSchema,
  MAX_IMAGE_OCR_BYTES,
  type ImageOcrFormValues,
} from "@/libs/schemas/image-ocr"
import { formatBytes } from "@/libs/utils/format"
import { useCopyText } from "@/libs/utils/use-copy-text"
import { useImageToText } from "../use-image-to-text"

export function ImageToTextPage() {
  const model = useImageToText()
  const copy = useCopyText()
  const error = model.selectionError ?? model.convert.error?.message
  const form = useForm({
    defaultValues: { preferAccuracy: false } as ImageOcrFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(ImageOcrFormSchema) },
    listeners: {
      onChange: () => {
        model.convert.reset()
        model.clearResult()
      },
    },
    onSubmit: ({ value }) => {
      if (!model.file) return

      model.convert.mutate({
        file: model.file,
        ...value,
        onProgress: (progress) => model.setProgress(progress),
      })
    },
  })
  const pendingLabel =
    model.progress?.phase === "loading-model"
      ? "Loading OCR model…"
      : model.progress?.phase === "recognizing"
        ? "Reading text…"
        : "Reading image…"

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="image-to-text" japanese="画像からテキストへ">
        <h1 className="text-3xl font-normal tracking-tight">Image to text (OCR)</h1>
        <p className="text-muted-foreground">
          Extract editable text from a screenshot or photo. OCR runs in your browser, and your image
          is never uploaded.
        </p>
      </ToolPageHeader>

      <Dropzone
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif,.png,.jpg,.jpeg,.webp,.avif,.gif"
        disabled={model.convert.isPending}
        label={model.file ? "Choose another image" : "Drop a screenshot or photo here"}
        hint={`PNG, JPEG, WebP, AVIF or GIF · up to ${MAX_IMAGE_OCR_BYTES / 1024 / 1024} MB`}
        onFiles={(files) => model.selectFile(files[0])}
      />

      {model.file && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          <span className="min-w-0 truncate">
            {model.file.name} · {formatBytes(model.file.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={model.convert.isPending}
            onClick={model.clear}
          >
            Remove
          </Button>
        </div>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="preferAccuracy">
          {(field) => (
            <label
              htmlFor="image-to-text-accuracy"
              aria-label="Prefer higher OCR accuracy"
              className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4"
            >
              <input
                id="image-to-text-accuracy"
                type="checkbox"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
                disabled={model.convert.isPending}
                className="mt-1 size-4 accent-primary"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">Prefer higher accuracy</span>
                <span className="text-sm text-muted-foreground">
                  Uses a larger first download and can take longer. Recommended for Japanese text,
                  faint screenshots, and dense text.
                </span>
              </span>
            </label>
          )}
        </form.Field>
        <p className="text-sm text-muted-foreground">
          First use downloads recognition data; your image stays in this browser. Complex columns
          may not keep their original reading order.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
          >
            {error}
          </p>
        )}
        {model.progress && (
          <output aria-live="polite" className="text-sm text-muted-foreground">
            {pendingLabel}
          </output>
        )}
        {model.file && !model.result && (
          <Button
            type="submit"
            className="self-end"
            disabled={model.convert.isPending}
            aria-busy={model.convert.isPending}
          >
            <DownloadIcon />
            {model.convert.isPending ? pendingLabel : "Extract text"}
          </Button>
        )}
      </form>

      {model.result && (
        <>
          <ConversionResult
            url={model.result.url}
            fileName={model.result.fileName}
            inputBytes={model.result.inputBytes}
            outputBytes={model.result.outputBytes}
            detail="text file"
          />
          <section className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">Extracted text</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => copy.copy(model.result!.text)}
              >
                {copy.status === "copied" ? <CheckIcon /> : <CopyIcon />}
                {copy.status === "copied" ? "Copied" : "Copy text"}
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-4 text-sm text-on-surface">
              {model.result.text}
            </pre>
            {copy.status === "failed" && (
              <p role="alert" className="text-sm text-error">
                Clipboard access failed. Select and copy the text above.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  )
}
