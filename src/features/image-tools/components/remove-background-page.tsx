import { useMutation } from "@tanstack/react-query"
import { Loader2Icon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_IMAGE_BYTES } from "@/libs/schemas/image"
import { removeImageBackground, validateRemoveBackgroundFile } from "../process"
import { useRemoveBackgroundStore } from "../store"
import { Dropzone } from "./dropzone"
import { Checkerboard, ImageFileCard, ImageResultCard } from "./image-result-parts"

export function RemoveBackgroundPage() {
  const { file, previewUrl, result, setFile, setResult, reset } = useRemoveBackgroundStore()
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (next: File) => removeImageBackground({ file: next }),
    onSuccess: setResult,
  })
  const selectFile = useMutation({ mutationFn: validateRemoveBackgroundFile })
  const errorMessage = error ?? mutation.error?.message ?? null

  const handleFile = (incoming: ReadonlyArray<File>) => {
    const next = incoming[0]

    if (!next) {
      return
    }

    mutation.reset()
    setError(null)
    selectFile.mutate(next, {
      onSuccess: (result) => {
        if (result.ok) {
          setFile(result.file)

          return
        }

        setError(result.message)
      },
    })
  }

  const handleRemove = () => {
    mutation.reset()
    selectFile.reset()
    setError(null)
    reset()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="image-remove-background" japanese="背景除去">
        <h1 className="text-3xl font-normal tracking-tight">Remove background</h1>
        <p className="text-muted-foreground">
          Remove a uniform background and download a transparent PNG. Best for studio shots;
          everything runs in your browser.
        </p>
      </ToolPageHeader>

      {file === null ? (
        <Dropzone
          accept="image/png,image/jpeg,image/webp"
          disabled={mutation.isPending || selectFile.isPending}
          onFiles={handleFile}
          hint={`PNG, JPEG, or WebP · up to ${MAX_IMAGE_BYTES / 1024 / 1024} MB`}
        />
      ) : (
        <Dropzone
          accept="image/png,image/jpeg,image/webp"
          compact
          disabled={mutation.isPending || selectFile.isPending}
          onFiles={handleFile}
          label="Replace image"
          hint="PNG, JPEG, or WebP"
        />
      )}

      {errorMessage && file === null && (
        <p
          role="alert"
          className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {errorMessage}
        </p>
      )}

      {file && (
        <ImageFileCard
          file={file}
          previewUrl={previewUrl}
          disabled={mutation.isPending}
          onRemove={handleRemove}
        />
      )}

      {file && (
        <Card>
          <CardContent className="flex flex-col gap-6 pt-6">
            {mutation.isPending && (
              <p className="flex items-center gap-2 text-sm font-medium">
                <Loader2Icon className="size-4 animate-spin" />
                Removing background…
              </p>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
              >
                {errorMessage}
              </p>
            )}

            {result && (
              <ImageResultCard
                result={result}
                title="PNG ready"
                description={`${result.width} × ${result.height}`}
              >
                <Checkerboard className="flex max-h-80 min-h-40 items-center justify-center">
                  <img
                    src={result.url}
                    alt="Background-removed preview"
                    className="max-h-80 w-full object-contain"
                  />
                </Checkerboard>
              </ImageResultCard>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" onClick={handleRemove} disabled={mutation.isPending}>
                <Trash2Icon /> Clear
              </Button>
              <Button
                type="button"
                onClick={() => void mutation.mutateAsync(file).catch(() => null)}
                disabled={mutation.isPending}
              >
                {mutation.isPending && <Loader2Icon className="animate-spin" />}
                {mutation.isPending ? "Removing…" : "Remove background"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
