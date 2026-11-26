import { useMutation } from "@tanstack/react-query"
import { DownloadIcon, FileArchiveIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InlineError } from "@/features/tools/components/inline-error"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { formatBytes } from "@/libs/utils/format"
import { generateFavicons } from "../process"
import { useFaviconStore } from "../store"

export function FaviconPage() {
  const { file, previewUrl, result, setFile, setResult, clearResult, reset } = useFaviconStore()
  const generate = useMutation({
    mutationFn: generateFavicons,
    onSuccess: (output, input) => {
      if (useFaviconStore.getState().file === input) setResult(output)
    },
  })

  const handleSelect = (files: ReadonlyArray<File>) => {
    const next = files[0]

    if (!next) return

    generate.reset()
    setFile(next)
  }

  const handleRemove = () => {
    generate.reset()
    reset()
  }

  const errorMessage = generate.error?.message ?? null

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="favicon-generator" japanese="ファビコン作成">
        <h1 className="text-3xl font-normal tracking-tight">Favicon & app icon generator</h1>
        <p className="text-muted-foreground">
          Turn one image into favicon.ico, PNG icons, a web manifest, and a ZIP. Everything stays in
          your browser.
        </p>
      </ToolPageHeader>

      {!file && (
        <Dropzone
          accept="image/png,image/jpeg,image/webp,image/avif"
          hint="PNG, JPEG, WebP or AVIF · square artwork works best · up to 25 MB"
          onFiles={handleSelect}
        />
      )}

      {file && (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <FileArchiveIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-base">{file.name}</CardTitle>
                <CardDescription>{formatBytes(file.size)}</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleRemove}
                disabled={generate.isPending}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="checkerboard flex max-h-72 min-h-40 items-center justify-center overflow-hidden rounded-md">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview of the selected artwork"
                  className="max-h-72 w-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={generate.isPending}
                aria-busy={generate.isPending}
                onClick={() => {
                  clearResult()
                  generate.mutate(file)
                }}
              >
                {generate.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                {generate.isPending ? "Creating icons…" : "Generate icon files"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Output: favicon.ico, 16/32/48/180/192/512 PNGs, manifest and HTML snippet.
              </p>
            </div>
            <InlineError>{errorMessage}</InlineError>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card size="sm" className="bg-tertiary-container text-on-tertiary-container">
          <CardHeader>
            <CardTitle className="text-base">Your icon package is ready</CardTitle>
            <CardDescription className="text-on-tertiary-container/80">
              {result.files.length} files · {formatBytes(result.zipBytes)} ZIP
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <img
                src={result.previewUrl}
                alt="Generated 512 pixel app icon"
                className="size-20 rounded-md bg-white object-contain ring-1 ring-outline-variant"
              />
              <Button
                render={
                  <a
                    href={result.url}
                    download={result.fileName}
                    aria-label={`Download ${result.fileName}`}
                  />
                }
                nativeButton={false}
              >
                <DownloadIcon /> Download {result.fileName}
              </Button>
            </div>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {result.files.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-xs">{entry.name}</span>
                  <span className="shrink-0 text-xs opacity-70">{formatBytes(entry.bytes)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs opacity-80">
              Upload the files to your site root, then paste the included HTML snippet into the head
              of your page.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
