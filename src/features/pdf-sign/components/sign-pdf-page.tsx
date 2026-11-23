import { FileSignatureIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PdfDropzone } from "@/features/pdf-tools/components/pdf-dropzone"
import { PageThumbnail } from "@/features/pdf-tools/components/page-thumbnail"
import { formatBytes } from "@/libs/utils/format"
import { useSignPdf } from "../use-sign-pdf"
import { PdfSignPreview } from "./pdf-sign-preview"
import { SignaturePanel } from "./signature-panel"

export function SignPdfPage() {
  const model = useSignPdf()
  const { file, result } = model

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">Sign PDF</h1>
        <p className="text-muted-foreground">
          Draw or upload signatures and place them on your PDF, right in your browser.
        </p>
      </div>
      {!file && (
        <PdfDropzone
          disabled={model.open.isPending}
          onFiles={(files) => {
            if (files[0]) model.open.mutate(files[0])
          }}
          label={model.open.isPending ? "Reading PDF…" : undefined}
        />
      )}
      {model.error && (
        <p role="alert" className="rounded-md bg-error-container p-3 text-on-error-container">
          {model.error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Visual signatures only—not cryptographic signatures. Export may invalidate existing digital
        signatures; encrypted PDFs are unsupported.
      </p>
      {file && (
        <>
          <Card size="sm">
            <CardContent className="flex items-center gap-4 p-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-outline-variant">
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
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={model.removeFile}
                aria-label="Remove PDF"
              >
                <XIcon />
              </Button>
            </CardContent>
          </Card>
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
            <PdfSignPreview model={model} />
            <SignaturePanel model={model} />
          </div>
          {model.exportPdf.error && (
            <p role="alert" className="rounded-md bg-error-container p-3 text-on-error-container">
              {model.exportPdf.error.message}
            </p>
          )}
          {result && (
            <div className="rounded-xl bg-tertiary-container p-4 text-on-tertiary-container">
              <p>
                Signed PDF ready · {formatBytes(file.size)} → {formatBytes(result.bytes)}
              </p>
              <Button
                className="mt-3"
                render={
                  <a
                    href={result.url}
                    download={`${file.name.replace(/\.pdf$/i, "")}-signed.pdf`}
                    aria-label="Download signed PDF"
                  />
                }
                nativeButton={false}
              >
                Download signed PDF
              </Button>
            </div>
          )}
          <Button
            className="self-end"
            disabled={model.placements.length === 0 || model.exportPdf.isPending}
            onClick={model.createPdf}
          >
            <FileSignatureIcon />
            {model.exportPdf.isPending
              ? "Preparing PDF…"
              : `Create signed PDF (${model.placements.length})`}
          </Button>
        </>
      )}
    </div>
  )
}
