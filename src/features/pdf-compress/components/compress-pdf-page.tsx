import { DownloadIcon, FileDownIcon, XIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { formatBytes } from "@/libs/utils/format"
import { useCompressPdf } from "../use-compress-pdf"

export function CompressPdfPage() {
  const model = useCompressPdf()
  const input = useRef<HTMLInputElement>(null)
  const { file, result } = model
  const reduction = result ? result.inputBytes - result.outputBytes : 0
  const reduced = reduction > 0

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">Compress PDF</h1>
        <p className="text-muted-foreground">
          Reduce file size with lossless optimization. Everything runs in your browser.
        </p>
      </div>
      {!file ? (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const selected = event.dataTransfer.files[0]

              if (selected) model.selectFile(selected)
            }}
            className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-outline bg-surface-container-low p-8 text-center transition-colors hover:bg-surface-container focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <FileDownIcon className="size-6" />
            </span>
            <span className="font-medium">Drop a PDF here, or click to browse</span>
            <span className="text-xs text-muted-foreground">
              PDF only · up to {MAX_PDF_BYTES / 1024 / 1024} MB
            </span>
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => {
                model.selectFile(event.target.files?.[0])
                event.target.value = ""
              }}
            />
          </button>
          {model.error && (
            <p role="alert" className="text-sm text-on-error-container">
              {model.error}
            </p>
          )}
        </>
      ) : (
        <Card size="sm">
          <CardContent className="flex items-center gap-4 p-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <FileDownIcon />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{file.name}</span>
              <span className="text-sm text-muted-foreground">{formatBytes(file.size)}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={model.clear} aria-label="Remove PDF">
              <XIcon />
            </Button>
          </CardContent>
        </Card>
      )}
      {(model.error || model.compress.error) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-error-container p-3 text-on-error-container"
        >
          <span>{model.error ?? model.compress.error?.message}</span>
          {model.compress.error?._tag === "PdfPasswordError" && (
            <div className="flex shrink-0 gap-2">
              <Input
                aria-label="PDF password"
                type="password"
                autoComplete="current-password"
                placeholder="PDF password"
                value={model.password}
                onChange={(event) => model.setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && file) {
                    event.preventDefault()
                    model.compress.mutate({ file, password: model.password })
                  }
                }}
                className="w-44 bg-surface text-foreground"
              />
              <Button
                size="sm"
                disabled={!model.password || model.compress.isPending}
                onClick={() => file && model.compress.mutate({ file, password: model.password })}
              >
                Unlock
              </Button>
            </div>
          )}
        </div>
      )}
      {file && !result && model.compress.error?._tag !== "PdfPasswordError" && (
        <Button
          className="self-end"
          disabled={model.compress.isPending}
          onClick={() => model.compress.mutate({ file })}
        >
          <FileDownIcon />
          {model.compress.isPending ? "Optimizing PDF…" : "Compress PDF"}
        </Button>
      )}
      {result && (
        <div className="rounded-xl bg-tertiary-container p-4 text-on-tertiary-container">
          <p className="font-medium">
            {reduced ? `Reduced by ${formatBytes(reduction)}` : "Already optimized"}
          </p>
          <p className="mt-1 text-sm">
            {formatBytes(result.inputBytes)} → {formatBytes(result.outputBytes)} · {result.pages}{" "}
            {result.pages === 1 ? "page" : "pages"}
            {!reduced && " · No quality loss"}
          </p>
          <Button
            className="mt-3"
            render={
              <a href={result.url} download={result.fileName} aria-label="Download optimized PDF" />
            }
            nativeButton={false}
          >
            <DownloadIcon />
            Download optimized PDF
          </Button>
        </div>
      )}
    </div>
  )
}
