import {
  MAX_VIDEO_GIF_FRAMES,
  MAX_VIDEO_GIF_OUTPUT_BYTES,
  MAX_VIDEO_GIF_PIXELS,
  MAX_VIDEO_GIF_SECONDS,
  MAX_VIDEO_GIF_SIDE,
  MAX_VIDEO_GIF_SOURCE_PIXELS,
  type VideoGifFormValues,
} from "@/libs/schemas/video-gif"
import { isAnimatedGif } from "./gif-validation"
import { clampClipEnd } from "./validation"

interface ConvertRequest {
  readonly id: number
  readonly file: File
  readonly options: VideoGifFormValues
}

type WorkerResponse =
  | { readonly id: number; readonly type: "progress"; readonly progress: number }
  | { readonly id: number; readonly type: "result"; readonly bytes: ArrayBuffer }
  | {
      readonly id: number
      readonly type: "error"
      readonly code:
        | "unsupported"
        | "duration"
        | "too-many-frames"
        | "memory"
        | "invalid-output"
        | "processing"
    }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ConvertRequest>) => void) | null
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void
}

const postError = (id: number, code: Extract<WorkerResponse, { type: "error" }>["code"]) =>
  scope.postMessage({ id, type: "error", code })

scope.onmessage = async ({ data }) => {
  let input: import("mediabunny").Input | undefined

  try {
    const [media, gifenc] = await Promise.all([import("mediabunny"), import("gifenc")])

    input = new media.Input({
      source: new media.BlobSource(data.file),
      formats: media.ALL_FORMATS,
    })

    const track = await input.getPrimaryVideoTrack()

    if (!track || !(await track.canDecode())) {
      postError(data.id, "unsupported")

      return
    }

    const firstTimestamp = await track.getFirstTimestampOrNull()
    const trackEnd = await track.computeDuration()
    const duration = trackEnd - (firstTimestamp ?? 0)
    const { startSeconds, endSeconds, fps, width } = data.options
    const effectiveEnd = clampClipEnd(endSeconds, duration)
    const clipDuration = effectiveEnd - startSeconds

    if (
      firstTimestamp === null ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      startSeconds >= duration ||
      clipDuration <= 0 ||
      clipDuration > MAX_VIDEO_GIF_SECONDS
    ) {
      postError(data.id, "duration")

      return
    }

    const frameCount = Math.ceil(clipDuration * fps)

    if (frameCount < 2 || frameCount > MAX_VIDEO_GIF_FRAMES) {
      postError(data.id, "too-many-frames")

      return
    }

    const sourceWidth = await track.getDisplayWidth()
    const sourceHeight = await track.getDisplayHeight()
    const sourcePixels = sourceWidth * sourceHeight

    if (
      !Number.isFinite(sourcePixels) ||
      sourceWidth <= 0 ||
      sourceHeight <= 0 ||
      sourcePixels > MAX_VIDEO_GIF_SOURCE_PIXELS
    ) {
      postError(data.id, "memory")

      return
    }

    const scale = Math.min(
      width / sourceWidth,
      MAX_VIDEO_GIF_SIDE / Math.max(sourceWidth, sourceHeight),
      Math.sqrt(MAX_VIDEO_GIF_PIXELS / sourcePixels),
    )
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale))
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale))
    const outputPixels = outputWidth * outputHeight

    if (
      outputPixels > MAX_VIDEO_GIF_PIXELS ||
      Math.max(outputWidth, outputHeight) > MAX_VIDEO_GIF_SIDE
    ) {
      postError(data.id, "memory")

      return
    }

    const sink = new media.CanvasSink(track, {
      width: outputWidth,
      height: outputHeight,
      fit: "contain",
      alpha: false,
      poolSize: 1,
    })
    const gif = gifenc.GIFEncoder()
    const frameDelay = Math.max(20, Math.round(100 / fps) * 10)
    const timestamps = Array.from(
      { length: frameCount },
      (_, index) => firstTimestamp + startSeconds + index / fps,
    )
    let encodedFrames = 0

    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      if (!wrapped) continue

      const context = wrapped.canvas.getContext("2d")

      if (!context) {
        postError(data.id, "processing")

        return
      }

      const image = context.getImageData(0, 0, outputWidth, outputHeight)
      const palette = gifenc.quantize(image.data, 128)
      const indexed = gifenc.applyPalette(image.data, palette, "rgb565")

      gif.writeFrame(indexed, outputWidth, outputHeight, {
        palette,
        delay: frameDelay,
        ...(encodedFrames === 0 ? { repeat: 0 } : {}),
      })

      encodedFrames += 1
      scope.postMessage({ id: data.id, type: "progress", progress: encodedFrames / frameCount })
    }

    if (encodedFrames < 2) {
      postError(data.id, "processing")

      return
    }

    gif.finish()
    const output = gif.bytes()

    if (output.byteLength > MAX_VIDEO_GIF_OUTPUT_BYTES) {
      postError(data.id, "memory")

      return
    }

    if (!isAnimatedGif(output)) {
      postError(data.id, "invalid-output")

      return
    }

    const bytes = output.buffer as ArrayBuffer

    scope.postMessage({ id: data.id, type: "result", bytes }, [bytes])
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message.toLowerCase() : String(cause).toLowerCase()
    const code = /memory|allocation|out of bounds|large/.test(message)
      ? "memory"
      : /unsupported|not supported|decoder|codec/.test(message)
        ? "unsupported"
        : "processing"

    postError(data.id, code)
  } finally {
    input?.dispose()
  }
}
