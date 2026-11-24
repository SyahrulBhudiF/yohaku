import { AudioLinesIcon, FileAudioIcon, FileVideoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { ConversionResult } from "@/features/document-tools/components/conversion-result"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_VIDEO_BYTES } from "@/libs/schemas/video"
import { useVideoToMp3 } from "../use-video-to-mp3"

export function VideoToMp3Page() {
  const model = useVideoToMp3()
  const error = model.selectionError ?? model.convert.error?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="video-to-mp3" japanese="動画をMP3に変換">
        <h1 className="text-3xl font-normal tracking-tight">Video to MP3</h1>
        <p className="text-muted-foreground">
          Extract the audio track from a video and save it as MP3. Processing stays on your device.
        </p>
      </ToolPageHeader>
      <FileDropzone
        accept="video/*,audio/*,.mkv,.webm,.mov,.mp4,.m4v,.mp3,.wav,.ogg,.aac,.flac"
        file={model.file}
        icon={FileVideoIcon}
        helperText={`Video or audio · up to ${MAX_VIDEO_BYTES / 1024 / 1024} MB`}
        onSelect={model.selectFile}
        onRemove={model.clear}
      />
      <p className="text-sm text-muted-foreground">
        Uses your browser’s media decoders and a small WASM MP3 encoder in a worker. For public
        YouTube, Instagram, or Facebook links, use the separate media downloader.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}
      {model.convert.isPending && (
        <Progress value={Math.round(model.progress * 100)} aria-label="MP3 conversion progress">
          <ProgressLabel>Extracting audio…</ProgressLabel>
          <ProgressValue />
        </Progress>
      )}
      {model.file && !model.result && (
        <Button
          className="self-end"
          disabled={model.convert.isPending}
          onClick={() => model.convert.mutate(model.file!)}
          aria-busy={model.convert.isPending}
        >
          <AudioLinesIcon />
          {model.convert.isPending ? "Converting to MP3…" : "Convert to MP3"}
        </Button>
      )}
      {model.result && (
        <ConversionResult
          url={model.result.url}
          fileName={model.result.fileName}
          inputBytes={model.result.inputBytes}
          outputBytes={model.result.outputBytes}
          detail="MP3 · 192 kbps"
        />
      )}
      {!model.file && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileAudioIcon aria-hidden="true" className="size-4" />
          <span>MP4, MOV, WebM, MKV, MP3, WAV and other browser-supported formats</span>
        </div>
      )}
    </main>
  )
}
