import { ArrowRightIcon, DownloadIcon, Loader2Icon, XIcon } from "lucide-react"
import type { StoreApi, UseBoundStore } from "zustand"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { IMAGE_FORMATS } from "@/libs/schemas/image"
import { formatBytes } from "@/libs/utils/format"
import { Dropzone } from "./dropzone"
import { isImageFormat, type FormatChoice } from "../store"
import type { useConvertStore } from "../store"

type ImageToolStore = UseBoundStore<StoreApi<ReturnType<typeof useConvertStore.getState>>>

interface ImageToolProps {
  readonly useStore: ImageToolStore
  readonly title: string
  readonly description: string
  readonly allowOriginalFormat: boolean
  readonly actionLabel: string
}

const toChoice = (value: string | null): FormatChoice | null => {
  if (value === "original") {
    return value
  }

  return value !== null && isImageFormat(value) ? value : null
}

export function ImageTool({
  useStore,
  title,
  description,
  allowOriginalFormat,
  actionLabel,
}: ImageToolProps) {
  const {
    file,
    previewUrl,
    format,
    quality,
    status,
    error,
    result,
    setFile,
    setFormat,
    setQuality,
    run,
    reset,
  } = useStore()
  const saved = result ? Math.round((1 - result.resultBytes / result.originalBytes) * 100) : 0

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {file === null ? (
        <Dropzone onFile={setFile} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="truncate text-base">{file.name}</CardTitle>
            <CardDescription>{formatBytes(file.size)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Selected file preview"
                className="max-h-72 w-full rounded-md bg-surface-container object-contain"
              />
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Output format</span>
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(toChoice(value) ?? format)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowOriginalFormat && <SelectItem value="original">Keep original</SelectItem>}
                    {IMAGE_FORMATS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-4">
                <span className="flex justify-between text-sm font-medium">
                  Quality <span className="text-muted-foreground tabular-nums">{quality}</span>
                </span>
                <Slider
                  min={1}
                  max={100}
                  value={[quality]}
                  aria-label="Quality"
                  onValueChange={(value) =>
                    setQuality(Array.isArray(value) ? (value[0] ?? quality) : value)
                  }
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
              >
                {error}
              </p>
            )}

            {result && (
              <div className="flex flex-col gap-3 rounded-lg bg-tertiary-container p-4 text-on-tertiary-container">
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums">{formatBytes(result.originalBytes)}</span>
                  <ArrowRightIcon className="size-4" />
                  <span className="font-medium tabular-nums">
                    {formatBytes(result.resultBytes)}
                  </span>
                  <span className="ml-auto font-medium">
                    {saved >= 0 ? `${saved}% smaller` : `${-saved}% larger`}
                  </span>
                </div>
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
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>
                <XIcon /> Remove
              </Button>
              <Button onClick={run} disabled={status === "processing"}>
                {status === "processing" && <Loader2Icon className="animate-spin" />}
                {status === "processing" ? "Working…" : actionLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
