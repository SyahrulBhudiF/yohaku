import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Schema } from "effect"
import { CheckIcon, CopyIcon, DownloadIcon, QrCodeIcon, ScanLineIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_QR_IMAGE_BYTES,
  MAX_QR_TEXT_CHARS,
  QR_CODE_FORMATS,
  QrCodeFormSchema,
  type QrCodeFormat,
  type QrCodeFormValues,
} from "@/libs/schemas/qr"
import { generateQrCode, scanQrCodeImage } from "../process"
import { useCopyText } from "@/libs/utils/use-copy-text"

const QR_FORMAT_LABEL: Record<QrCodeFormat, string> = {
  png: "PNG image",
  svg: "SVG image",
}

export function QrCodePage() {
  const copy = useCopyText()
  const generate = useMutation({ mutationFn: generateQrCode })
  const scan = useMutation({
    mutationFn: scanQrCodeImage,
    onMutate: copy.reset,
  })
  const form = useForm({
    defaultValues: { text: "https://", format: "png" } as QrCodeFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(QrCodeFormSchema) },
    listeners: {
      onChange: () => generate.reset(),
    },
    onSubmit: ({ value }) => generate.mutate(value),
  })

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <ToolPageHeader id="qr-code" japanese="QRコードを作成・読み取り">
        <h1 className="text-3xl font-normal tracking-tight">QR code generator & reader</h1>
        <p className="text-muted-foreground">
          Create a QR code from text or a URL, or read one from an image. Your content and images
          stay on your device.
        </p>
      </ToolPageHeader>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCodeIcon aria-hidden="true" className="size-5" />
              Create a QR code
            </CardTitle>
            <CardDescription>
              Enter up to {MAX_QR_TEXT_CHARS.toLocaleString("en-US")} characters of text or a URL.
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
              <form.Field name="text">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor={field.name} className="text-sm font-medium">
                      Text or URL
                    </label>
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      maxLength={MAX_QR_TEXT_CHARS}
                      rows={4}
                      aria-invalid={field.state.meta.errors.length > 0}
                      className="w-full resize-y rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      placeholder="https://example.com"
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <span className="text-right text-xs text-muted-foreground">
                      {field.state.value.length}/{MAX_QR_TEXT_CHARS.toLocaleString("en-US")}{" "}
                      characters
                    </span>
                    {field.state.meta.errors.length > 0 && (
                      <p role="alert" className="text-sm text-error">
                        Enter text (up to {MAX_QR_TEXT_CHARS.toLocaleString("en-US")} characters).
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="format">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="qr-format" className="text-sm font-medium">
                      Download format
                    </label>
                    <select
                      id="qr-format"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value as QrCodeFormValues["format"])
                      }
                      className="h-12 rounded-xl border border-outline-variant bg-surface px-4 text-sm"
                    >
                      {QR_CODE_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {QR_FORMAT_LABEL[format]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </form.Field>

              <Button type="submit" disabled={generate.isPending} aria-busy={generate.isPending}>
                <QrCodeIcon />
                {generate.isPending ? "Creating…" : "Create QR code"}
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
              <div className="mt-5 flex flex-col items-center gap-4 rounded-xl bg-surface-container-low p-4">
                <img
                  src={generate.data.dataUrl}
                  alt={`QR code for ${form.state.values.text}`}
                  className="size-56 max-w-full rounded-lg bg-surface p-2 object-contain"
                />
                <a
                  href={generate.data.dataUrl}
                  download={generate.data.fileName}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <DownloadIcon className="size-4" />
                  Download {generate.data.format.toUpperCase()}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLineIcon aria-hidden="true" className="size-5" />
              Read a QR code
            </CardTitle>
            <CardDescription>
              Select a PNG, JPEG, WebP, AVIF, or GIF image (up to 20 MB).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Dropzone
              accept="image/png,image/jpeg,image/webp,image/avif,image/gif,.png,.jpg,.jpeg,.webp,.avif,.gif"
              disabled={scan.isPending}
              {...(scan.isPending ? { label: "Reading image…" } : {})}
              hint={`PNG, JPEG, WebP, AVIF or GIF · up to ${MAX_QR_IMAGE_BYTES / 1024 / 1024} MB`}
              onFiles={(files) => {
                const file = files[0]

                if (file) {
                  scan.reset()
                  scan.mutate(file)
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Decoding happens locally in your browser. Images over 24 megapixels are rejected.
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
                <p className="text-sm font-medium">Decoded text</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-sm">
                  {scan.data}
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() => copy.copy(scan.data)}
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
