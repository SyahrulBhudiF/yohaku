import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { BarcodeIcon, CheckIcon, CopyIcon, DownloadIcon, ScanLineIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  BARCODE_FORMATS,
  BarcodeFormSchema,
  MAX_BARCODE_IMAGE_BYTES,
  MAX_BARCODE_IMAGE_PIXELS,
  MAX_BARCODE_VALUE_CHARS,
  type BarcodeFormat,
  type BarcodeFormValues,
} from "@/libs/schemas/barcode"
import { useCopyText } from "@/libs/utils/use-copy-text"
import { generateBarcode, scanBarcodeImage } from "../process"

const BARCODE_FORMAT_LABEL: Record<BarcodeFormat, string> = {
  code128: "Code 128",
  ean13: "EAN-13",
  upca: "UPC-A",
}

const BARCODE_FORMAT_HINT: Record<BarcodeFormat, string> = {
  code128: "Printable ASCII text or numbers.",
  ean13: "12 digits; the 13th check digit is added automatically.",
  upca: "11 digits; the 12th check digit is added automatically.",
}

const BARCODE_FORMAT_PLACEHOLDER: Record<BarcodeFormat, string> = {
  code128: "YOHaku-2026",
  ean13: "490123456789",
  upca: "03600029145",
}

export function BarcodePage() {
  const copy = useCopyText()
  const generate = useMutation({ mutationFn: generateBarcode })
  const scan = useMutation({
    mutationFn: scanBarcodeImage,
    onMutate: copy.reset,
  })
  const form = useForm({
    defaultValues: { format: "code128", value: "" } as BarcodeFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(BarcodeFormSchema) },
    listeners: {
      onChange: () => generate.reset(),
    },
    onSubmit: ({ value }) => generate.mutate(value),
  })

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <ToolPageHeader id="barcode" japanese="バーコード作成・読取">
        <h1 className="text-3xl font-normal tracking-tight">Barcode generator & reader</h1>
        <p className="text-muted-foreground">
          Create Code 128, EAN-13 or UPC-A barcodes, or read one from an image. Everything stays on
          your device.
        </p>
      </ToolPageHeader>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarcodeIcon aria-hidden="true" className="size-5" />
              Create a barcode
            </CardTitle>
            <CardDescription>
              Choose a format and enter the value. Download the result as PNG or SVG.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
            >
              <form.Field name="format">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="barcode-format" className="text-sm font-medium">
                      Format
                    </label>
                    <select
                      id="barcode-format"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value as BarcodeFormat)}
                      className="h-12 rounded-xl border border-outline-variant bg-surface px-4 text-sm"
                    >
                      {BARCODE_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {BARCODE_FORMAT_LABEL[format]}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {BARCODE_FORMAT_HINT[field.state.value]}
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Field name="value">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="barcode-value" className="text-sm font-medium">
                      Value
                    </label>
                    <input
                      id="barcode-value"
                      name={field.name}
                      type="text"
                      value={field.state.value}
                      maxLength={MAX_BARCODE_VALUE_CHARS}
                      aria-invalid={field.state.meta.errors.length > 0}
                      className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      placeholder={BARCODE_FORMAT_PLACEHOLDER[form.state.values.format]}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <span className="text-right text-xs text-muted-foreground">
                      {field.state.value.length}/{MAX_BARCODE_VALUE_CHARS} characters
                    </span>
                    {field.state.meta.errors.length > 0 && (
                      <p role="alert" className="text-sm text-error">
                        Enter a value up to {MAX_BARCODE_VALUE_CHARS} characters.
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <Button type="submit" disabled={generate.isPending} aria-busy={generate.isPending}>
                <BarcodeIcon />
                {generate.isPending ? "Creating…" : "Create barcode"}
              </Button>
              {generate.error && (
                <p
                  role="alert"
                  className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
                >
                  {generate.error.message}
                </p>
              )}
            </form>

            {generate.data && (
              <div className="mt-5 flex flex-col gap-4 rounded-xl bg-surface-container-low p-4">
                <div className="rounded-lg bg-white p-3">
                  <img
                    src={generate.data.svgDataUrl}
                    alt={`${BARCODE_FORMAT_LABEL[generate.data.format]} barcode for ${generate.data.text}`}
                    className="mx-auto max-h-40 w-full object-contain"
                  />
                </div>
                <p className="text-sm">
                  Encoded value:{" "}
                  <span className="font-mono text-on-surface">{generate.data.text}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    render={
                      <a
                        href={generate.data.pngDataUrl}
                        download={`${generate.data.fileName}.png`}
                        aria-label={`Download ${generate.data.fileName} PNG`}
                      />
                    }
                    nativeButton={false}
                  >
                    <DownloadIcon />
                    Download PNG
                  </Button>
                  <Button
                    variant="secondary"
                    render={
                      <a
                        href={generate.data.svgDataUrl}
                        download={`${generate.data.fileName}.svg`}
                        aria-label={`Download ${generate.data.fileName} SVG`}
                      />
                    }
                    nativeButton={false}
                  >
                    <DownloadIcon />
                    Download SVG
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLineIcon aria-hidden="true" className="size-5" />
              Read a barcode
            </CardTitle>
            <CardDescription>
              Select a PNG, JPEG, WebP, AVIF or GIF image with a visible Code 128, EAN-13 or UPC-A
              barcode.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Dropzone
              accept="image/png,image/jpeg,image/webp,image/avif,image/gif,.png,.jpg,.jpeg,.webp,.avif,.gif"
              disabled={scan.isPending}
              {...(scan.isPending ? { label: "Reading image…" } : {})}
              hint={`PNG, JPEG, WebP, AVIF or GIF · up to ${MAX_BARCODE_IMAGE_BYTES / 1024 / 1024} MB`}
              onFiles={(files) => {
                const file = files[0]

                if (file) {
                  scan.reset()
                  scan.mutate(file)
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Decoding happens locally in your browser. Images over{" "}
              {MAX_BARCODE_IMAGE_PIXELS / 1_000_000} megapixels are rejected.
            </p>
            {scan.isPending && (
              <output className="text-sm text-muted-foreground">Reading image…</output>
            )}
            {scan.error && (
              <p
                role="alert"
                className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
              >
                {scan.error.message}
              </p>
            )}
            {scan.data && (
              <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4">
                <p className="text-sm">
                  Format: <span className="font-medium">{scan.data.format}</span>
                </p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 font-mono text-sm">
                  {scan.data.text}
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() => copy.copy(scan.data.text)}
                >
                  {copy.status === "copied" ? <CheckIcon /> : <CopyIcon />}
                  {copy.status === "copied" ? "Copied" : "Copy decoded text"}
                </Button>
                {copy.status === "failed" && (
                  <p role="alert" className="text-sm text-error">
                    Clipboard access failed. Select and copy the decoded text above.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
