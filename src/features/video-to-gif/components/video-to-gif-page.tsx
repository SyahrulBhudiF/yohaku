import { useForm } from "@tanstack/react-form"
import { Schema } from "effect"
import { FileVideoIcon, FilmIcon, ScissorsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import {
  MAX_VIDEO_GIF_FPS,
  MAX_VIDEO_GIF_FRAMES,
  MAX_VIDEO_GIF_INPUT_BYTES,
  MAX_VIDEO_GIF_SECONDS,
  VIDEO_GIF_WIDTHS,
  type VideoGifFormValues,
  VideoGifFormSchema,
} from "@/libs/schemas/video-gif"
import { useVideoToGif } from "../use-video-to-gif"

export function VideoToGifPage() {
  const model = useVideoToGif()
  const error = model.selectionError ?? model.convert.error?.message
  const form = useForm({
    defaultValues: {
      startSeconds: 0,
      endSeconds: 5,
      fps: 10,
      width: 360,
    } as VideoGifFormValues,
    validators: { onChange: Schema.toStandardSchemaV1(VideoGifFormSchema) },
    listeners: {
      onChange: () => {
        model.convert.reset()
        model.clearResult()
      },
    },
    onSubmit: ({ value }) => {
      if (!model.file) return

      model.convert.mutate({ selectedFile: model.file, options: value })
    },
  })

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="video-to-gif" japanese="動画をGIFに変換">
        <h1 className="text-3xl font-normal tracking-tight">Video to GIF</h1>
        <p className="text-muted-foreground">
          Trim a short video clip and turn it into an animated GIF. Your video stays on this device.
        </p>
      </ToolPageHeader>
      <FileDropzone
        accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.ogv,.3gp"
        file={model.file}
        icon={FileVideoIcon}
        helperText={`Video only · up to ${MAX_VIDEO_GIF_INPUT_BYTES / 1024 / 1024} MB`}
        onSelect={model.selectFile}
        onRemove={model.clear}
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}
      {model.file && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="startSeconds">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="video-gif-start" className="text-sm font-medium">
                    Start time (seconds)
                  </label>
                  <Input
                    id="video-gif-start"
                    type="number"
                    min={0}
                    max={600}
                    step="0.1"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(Number(event.target.value))}
                    disabled={model.convert.isPending}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-error">Enter a start time from 0 to 600 seconds.</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name="endSeconds">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="video-gif-end" className="text-sm font-medium">
                    End time (seconds)
                  </label>
                  <Input
                    id="video-gif-end"
                    type="number"
                    min={0.1}
                    max={600}
                    step="0.1"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(Number(event.target.value))}
                    disabled={model.convert.isPending}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-error">Enter an end time from 0.1 to 600 seconds.</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name="fps">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="video-gif-fps" className="text-sm font-medium">
                    Frame rate (FPS)
                  </label>
                  <Input
                    id="video-gif-fps"
                    type="number"
                    min={5}
                    max={MAX_VIDEO_GIF_FPS}
                    step={1}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(Number(event.target.value))}
                    disabled={model.convert.isPending}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-error">Choose 5–{MAX_VIDEO_GIF_FPS} FPS.</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name="width">
              {(field) => (
                <label
                  htmlFor="video-gif-width"
                  className="flex flex-col gap-2 text-sm font-medium"
                >
                  Maximum output width (pixels)
                  <select
                    id="video-gif-width"
                    className="h-12 rounded-sm border border-outline bg-surface px-4 text-sm font-normal focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(Number(event.target.value) as VideoGifFormValues["width"])
                    }
                    disabled={model.convert.isPending}
                  >
                    {VIDEO_GIF_WIDTHS.map((width) => (
                      <option key={width} value={width}>
                        {width} px
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </form.Field>
          </div>
          <p className="flex items-start gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-muted-foreground">
            <ScissorsIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            GIFs are limited to {MAX_VIDEO_GIF_SECONDS} seconds and {MAX_VIDEO_GIF_FRAMES} frames. A
            smaller output width and lower frame rate reduce memory use and file size. If the video
            ends before your end time, the GIF stops at the end of the video.
          </p>
          {model.convert.isPending && (
            <Progress value={Math.round(model.progress * 100)} aria-label="GIF conversion progress">
              <ProgressLabel>Creating GIF frames…</ProgressLabel>
              <ProgressValue />
            </Progress>
          )}
          {!model.result && (
            <Button
              type="submit"
              className="self-end"
              disabled={model.convert.isPending}
              aria-busy={model.convert.isPending}
            >
              <FilmIcon />
              {model.convert.isPending ? "Converting to GIF…" : "Convert to GIF"}
            </Button>
          )}
        </form>
      )}
      {model.result && (
        <ConversionResult
          url={model.result.url}
          fileName={model.result.fileName}
          inputBytes={model.result.inputBytes}
          outputBytes={model.result.outputBytes}
          detail="Animated GIF"
        />
      )}
      {!model.file && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileVideoIcon aria-hidden="true" className="size-4" />
          <span>MP4, MOV, WebM, MKV and other browser-supported video files</span>
        </div>
      )}
    </main>
  )
}
