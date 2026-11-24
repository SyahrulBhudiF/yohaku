import { useForm } from "@tanstack/react-form"
import { Schema } from "effect"
import {
  AudioLinesIcon,
  CameraIcon,
  DownloadIcon,
  FileVideoIcon,
  LinkIcon,
  VideoIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { ConversionResult } from "@/features/document-tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_SOCIAL_MEDIA_AUDIO_BYTES,
  SocialMediaUrlFormSchema,
  type SocialMediaPlatform,
  type SocialMediaUrlFormValues,
} from "@/libs/schemas/social-media"
import { formatBytes } from "@/libs/utils/format"
import {
  formatDuration,
  getSocialMediaEmbedUrl,
  mediaFileStem,
  parseSocialMediaUrl,
} from "../validation"
import type { BrowserFileHandle, SocialMediaDownloadRequest } from "../process"
import { useSocialMediaDownloader } from "../use-social-media-downloader"
import { SocialMediaPreview } from "./social-media-preview"

declare global {
  interface Window {
    showSaveFilePicker?: (options: { readonly suggestedName: string }) => Promise<BrowserFileHandle>
  }
}

type SaveTargetResult =
  | { readonly kind: "handle"; readonly handle: BrowserFileHandle }
  | { readonly kind: "browser-download" }
  | { readonly kind: "cancelled" }

const chooseSaveTarget = async (fileName: string): Promise<SaveTargetResult> => {
  if (!window.showSaveFilePicker) return { kind: "browser-download" }

  try {
    return {
      kind: "handle",
      handle: await window.showSaveFilePicker({ suggestedName: fileName }),
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      return { kind: "cancelled" }
    }

    return { kind: "cancelled" }
  }
}

const videoExtension = (
  container: string | null | undefined,
  mimeType: string | null | undefined,
) => (container === "WebM" || mimeType?.includes("webm") ? "webm" : "mp4")

const PLATFORM_LABELS: Record<SocialMediaPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
}

export function SocialMediaDownloaderPage() {
  const model = useSocialMediaDownloader()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mode, setMode] = useState<"video" | "mp3">("video")
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { url: "" } as SocialMediaUrlFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(SocialMediaUrlFormSchema) },
    listeners: {
      onChange: () => {
        model.reset()
        setValidationError(null)
        setResultUrl(null)
      },
    },
    onSubmit: async ({ value }) => {
      const parsed = parseSocialMediaUrl(value.url)

      if (!parsed.ok) {
        setValidationError(parsed.message)

        return
      }

      model.download.reset()
      setValidationError(null)
      setMode("video")
      await model.resolve.mutateAsync(parsed.url).catch(() => null)
    },
  })
  const resolved = model.resolve.data
  const videoFormat = resolved?.videoFormat ?? null
  const audioFormat = resolved?.audioFormat ?? null
  const previewUrl = resolved
    ? getSocialMediaEmbedUrl(resolved.platform, resolved.info.webpage_url)
    : null
  const result = model.download.data
  const fileResult = result?.kind === "file" ? result : null
  const error =
    validationError ?? model.resolve.error?.message ?? model.download.error?.message ?? null

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  const handleDownload = async (selectedMode: "video" | "mp3") => {
    if (!resolved) return

    const format = selectedMode === "video" ? videoFormat : audioFormat

    if (!format) return

    const extension =
      selectedMode === "mp3" ? "mp3" : videoExtension(format.container, format.mime_type)
    const fileName = `${mediaFileStem(resolved.info.title)}.${extension}`
    let saveHandle: BrowserFileHandle | undefined

    if (selectedMode === "video") {
      const target = await chooseSaveTarget(fileName)

      if (target.kind === "cancelled") return
      if (target.kind === "handle") saveHandle = target.handle
    }

    const request: SocialMediaDownloadRequest = {
      format,
      platform: resolved.platform,
      fileName,
      mode: selectedMode,
      ...(saveHandle ? { saveHandle } : {}),
    }

    setResultUrl(null)

    const downloadResult = await model.download.mutateAsync(request).catch(() => null)

    if (downloadResult?.kind === "file") {
      setResultUrl(URL.createObjectURL(downloadResult.blob))
    }
  }

  const selectedVideo = mode === "video" ? videoFormat : audioFormat
  const duration = formatDuration(resolved?.info.duration ?? null)
  const progressLabel =
    model.progress.phase === "convert" ? "Converting audio to MP3…" : "Downloading media…"
  const isPending = model.resolve.isPending || model.download.isPending

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="social-media-downloader" japanese="動画をダウンロード">
        <h1 className="text-3xl font-normal tracking-tight">
          YouTube, Instagram &amp; Facebook downloader
        </h1>
        <p className="text-muted-foreground">
          Paste a public YouTube, Instagram, or Facebook link and save the video or extract an MP3.
          Media is streamed through Yohaku and processed in your browser.
        </p>
      </ToolPageHeader>

      <Card>
        <CardContent className="pt-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="url">
              {(field) => (
                <label
                  htmlFor="social-media-url"
                  className="flex flex-col gap-2 text-sm font-medium"
                >
                  Video link
                  <Input
                    id="social-media-url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={isPending}
                    aria-invalid={Boolean(validationError)}
                  />
                </label>
              )}
            </form.Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <VideoIcon aria-hidden="true" className="size-4" />
                <CameraIcon aria-hidden="true" className="size-4" />
                <span>Public YouTube, Instagram and Facebook videos</span>
              </div>
              <Button type="submit" disabled={isPending} aria-busy={isPending}>
                <LinkIcon />
                {model.resolve.isPending ? "Reading link…" : "Get video"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}

      {resolved && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{resolved.info.title}</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
              {resolved.info.uploader && <span>{resolved.info.uploader}</span>}
              {duration && <span>{duration}</span>}
              <span>{PLATFORM_LABELS[resolved.platform]}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {previewUrl && (
              <SocialMediaPreview
                aspectRatio={
                  videoFormat?.video?.width && videoFormat.video.height
                    ? videoFormat.video.width / videoFormat.video.height
                    : 16 / 9
                }
                embedUrl={previewUrl}
                title={resolved.info.title}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={mode === "video"}
                disabled={!videoFormat || model.download.isPending}
                onClick={() => setMode("video")}
                className={`flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${mode === "video" ? "border-primary bg-primary-container text-on-primary-container" : "border-outline bg-surface-container-low hover:bg-surface-container"}`}
              >
                <FileVideoIcon className="mt-0.5 size-5 shrink-0" />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">Video file</span>
                  <span className="text-xs text-muted-foreground">
                    {videoFormat
                      ? `${videoExtension(videoFormat.container, videoFormat.mime_type).toUpperCase()}${videoFormat.video?.height ? ` · ${videoFormat.video.height}p` : ""}${videoFormat.filesize ? ` · ${formatBytes(videoFormat.filesize)}` : ""}`
                      : "No progressive video with audio is available"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={mode === "mp3"}
                disabled={!audioFormat || model.download.isPending}
                onClick={() => setMode("mp3")}
                className={`flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${mode === "mp3" ? "border-primary bg-primary-container text-on-primary-container" : "border-outline bg-surface-container-low hover:bg-surface-container"}`}
              >
                <AudioLinesIcon className="mt-0.5 size-5 shrink-0" />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">MP3 audio</span>
                  <span className="text-xs text-muted-foreground">
                    {audioFormat
                      ? `192 kbps${audioFormat.audio?.bitrate ? ` · source ${Math.round(audioFormat.audio.bitrate / 1000)} kbps` : ""}`
                      : "No audio stream is available"}
                  </span>
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {mode === "mp3" &&
                  `MP3 conversion uses up to ${MAX_SOCIAL_MEDIA_AUDIO_BYTES / 1024 / 1024} MB of source media.`}
              </p>
              <Button
                disabled={!selectedVideo || model.download.isPending}
                onClick={() => void handleDownload(mode)}
                aria-busy={model.download.isPending}
              >
                <DownloadIcon />
                {model.download.isPending
                  ? model.progress.phase === "convert"
                    ? "Converting…"
                    : "Downloading…"
                  : mode === "mp3"
                    ? "Download MP3"
                    : "Download video"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {model.download.isPending && (
        <Progress
          value={Math.round(model.progress.progress * 100)}
          aria-label={progressLabel}
          aria-valuetext={progressLabel}
        >
          <ProgressLabel>{progressLabel}</ProgressLabel>
          <ProgressValue />
        </Progress>
      )}

      {result?.kind === "saved" && (
        <Card className="bg-tertiary-container text-on-tertiary-container">
          <CardContent className="pt-4">
            <p className="font-medium">Video saved</p>
            <p className="mt-1 text-sm">
              {result.fileName} · {formatBytes(result.outputBytes)}
            </p>
          </CardContent>
        </Card>
      )}

      {fileResult && resultUrl && (
        <ConversionResult
          url={resultUrl}
          fileName={fileResult.fileName}
          inputBytes={fileResult.inputBytes}
          outputBytes={fileResult.outputBytes}
          detail={fileResult.fileName.endsWith(".mp3") ? "MP3 · 192 kbps" : "video file"}
        />
      )}

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-muted-foreground">
        Only public posts are supported; private, age-restricted, or region-blocked media will not
        work. Download only content you own or are allowed to use. MP3 conversion is limited to{" "}
        {MAX_SOCIAL_MEDIA_AUDIO_BYTES / 1024 / 1024} MB of source media.
      </p>
    </main>
  )
}
