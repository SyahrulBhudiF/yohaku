import { Effect } from "effect"

import { SocialMediaDownloaderError } from "@/infrastructure/errors/social-media"
import { VideoToMp3Error } from "@/infrastructure/errors/video"
import { runEffect } from "@/infrastructure/runtime"
import {
  MAX_SOCIAL_MEDIA_AUDIO_BYTES,
  MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES,
  MAX_SOCIAL_MEDIA_MERGE_BYTES,
  type SocialMediaFormat,
  type SocialMediaInfo,
  type SocialMediaPlatform,
} from "@/libs/schemas/social-media"
import { convertVideoToMp3 } from "@/features/video-to-mp3/process"
import { mergeInWorker, type MergeContainer } from "./merge"
import {
  decodeSocialMediaInfo,
  parseSocialMediaUrl,
  selectAudioSource,
  selectMergedVideo,
  selectProgressiveVideo,
  type MergedVideo,
} from "./validation"

export interface ResolvedSocialMedia {
  readonly info: SocialMediaInfo
  readonly platform: SocialMediaPlatform
  readonly videoId: string | null
  readonly videoFormat: SocialMediaFormat | null
  readonly audioFormat: SocialMediaFormat | null
  readonly mergedVideo: MergedVideo | null
}

export interface BrowserFileHandle {
  createWritable: () => Promise<BrowserFileWriter>
}

export interface BrowserFileWriter {
  write: (data: Uint8Array) => Promise<void>
  close: () => Promise<void>
  abort?: () => Promise<void>
}

export interface SocialMediaDownloadRequest {
  readonly format: SocialMediaFormat
  readonly platform: SocialMediaPlatform
  readonly fileName: string
  readonly mode: "video" | "mp3"
  readonly videoId?: string
  readonly saveHandle?: BrowserFileHandle
  readonly merge?: {
    readonly video: SocialMediaFormat
    readonly audio: SocialMediaFormat
    readonly container: MergeContainer
  }
}

export interface DownloadProgress {
  readonly phase: "download" | "convert" | "merge"
  readonly progress: number
}

export type SocialMediaDownloadResult =
  | {
      readonly kind: "saved"
      readonly fileName: string
      readonly outputBytes: number
    }
  | {
      readonly kind: "file"
      readonly blob: Blob
      readonly fileName: string
      readonly inputBytes: number
      readonly outputBytes: number
    }

type ResolverWorkerResponse =
  | { readonly id: number; readonly type: "result"; readonly info: unknown }
  | { readonly id: number; readonly type: "error"; readonly message: string }

interface PendingResolve {
  readonly resolve: (info: unknown) => void
  readonly reject: (message: string) => void
}

type TransferResult =
  | { readonly ok: true; readonly blob: Blob; readonly bytes: number; readonly mimeType: string }
  | { readonly ok: false; readonly reason: "too-large" | "unavailable" }

type SaveResult =
  | { readonly ok: true; readonly bytes: number }
  | { readonly ok: false; readonly reason: "too-large" | "unavailable" }

const pendingResolvers = new Map<number, PendingResolve>()
let resolverWorker: Worker | null = null
let nextRequestId = 1

const isDownloadTooLarge = (cause: unknown) =>
  cause instanceof DOMException && cause.name === "QuotaExceededError"

const failPendingResolvers = () => {
  for (const request of pendingResolvers.values()) {
    request.reject("worker")
  }

  pendingResolvers.clear()
  resolverWorker = null
}

const getResolverWorker = () => {
  if (resolverWorker) return resolverWorker

  const worker = new Worker(new URL("./resolver-worker.ts", import.meta.url), { type: "module" })

  worker.onmessage = ({ data }: MessageEvent<ResolverWorkerResponse>) => {
    const request = pendingResolvers.get(data.id)

    if (!request) return

    pendingResolvers.delete(data.id)

    if (data.type === "result") {
      request.resolve(data.info)
    } else {
      request.reject(data.message)
    }
  }

  worker.onerror = failPendingResolvers
  worker.onmessageerror = failPendingResolvers
  resolverWorker = worker

  return worker
}

const resolveInWorker = (url: string) =>
  new Promise<unknown>((resolve, reject) => {
    const id = nextRequestId++

    pendingResolvers.set(id, { resolve, reject })
    getResolverWorker().postMessage({ id, url })
  })

const shouldRetryResolve = (cause: unknown) => {
  const detail = typeof cause === "string" ? cause : ""

  if (
    /bot-check|http 403|http 429|timed out|timeout|network|failed to fetch|request failed|worker/i.test(
      detail,
    )
  ) {
    return true
  }

  return !/unsupported url|no extractor|only individual video|not a public video|age-restricted|geo-blocked|private|gone|not found|image-only|no video|no playable formats|formatnotfound|does not expose|unavailable/i.test(
    detail,
  )
}

// Each attempt is a new Worker request, so a transient YouTube bot check can
// land on a different egress IP and succeed without asking the user to retry.
const resolveWithRetry = async (url: string) => {
  let last: unknown = "worker"

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await resolveInWorker(url)
    } catch (cause) {
      last = cause

      if (attempt === 2 || !shouldRetryResolve(cause)) throw cause

      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }

  throw last
}

const PLATFORM_NAMES: Record<SocialMediaPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
}

const mapResolveFailure = (cause: unknown, platform: SocialMediaPlatform) => {
  const detail = typeof cause === "string" ? cause : ""
  const platformName = PLATFORM_NAMES[platform]

  if (/bot-check/i.test(detail)) {
    return new SocialMediaDownloaderError({
      message: `${platformName} is asking for a bot check, so this link cannot be resolved right now. Try again later.`,
    })
  }

  if (/instagram rejected|facebook rejected|login wall|http 403|http 401|http 429/i.test(detail)) {
    return new SocialMediaDownloaderError({
      message: `${platformName} blocked this request. Only public posts work, and access can change without notice.`,
    })
  }

  if (/unsupported url|no extractor|only individual video|not a public video/i.test(detail)) {
    return new SocialMediaDownloaderError({
      message:
        "Paste a direct YouTube video, YouTube Short, Instagram Reel, or Facebook video link.",
    })
  }

  if (/age-restricted|geo-blocked|private|gone|not found|unavailable/i.test(detail)) {
    return new SocialMediaDownloaderError({
      message: "This video is private, restricted, or no longer available publicly.",
    })
  }

  if (
    /image-only|no video|no playable formats|formatnotfound|does not expose a downloadable video/i.test(
      detail,
    )
  ) {
    return new SocialMediaDownloaderError({
      message: "This post does not contain a downloadable video.",
    })
  }

  return new SocialMediaDownloaderError({
    message: "Could not read this public video. The platform may be temporarily blocking requests.",
  })
}

export const resolveSocialMedia = (
  input: string,
): Effect.Effect<ResolvedSocialMedia, SocialMediaDownloaderError> =>
  Effect.gen(function* () {
    const parsed = parseSocialMediaUrl(input)

    if (!parsed.ok) {
      return yield* new SocialMediaDownloaderError({ message: parsed.message })
    }

    const raw = yield* Effect.tryPromise({
      try: () => resolveWithRetry(parsed.url),
      catch: (cause) => mapResolveFailure(cause, parsed.platform),
    })
    const info = decodeSocialMediaInfo(raw)

    if (!info || info.is_live) {
      return yield* new SocialMediaDownloaderError({
        message: "This link did not return a downloadable on-demand video.",
      })
    }

    const videoFormat = selectProgressiveVideo(info)
    const audioFormat = selectAudioSource(info)
    const mergedVideo = videoFormat ? null : selectMergedVideo(info)

    if (!videoFormat && !mergedVideo && !audioFormat) {
      return yield* new SocialMediaDownloaderError({
        message: "No public video or audio stream was available for this link.",
      })
    }

    const videoId = parsed.platform === "youtube" ? new URL(parsed.url).searchParams.get("v") : null

    return {
      info,
      platform: parsed.platform,
      videoId,
      videoFormat,
      audioFormat,
      mergedVideo,
    }
  })

const downloadFormatResponse = (
  format: SocialMediaFormat,
  platform: SocialMediaPlatform,
  fileName: string,
  videoId?: string,
) =>
  fetch("/api/media/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: format.url,
      platform,
      fileName,
      headers: (format.http_headers ?? []).map(([name, value]) => ({ name, value })),
      ...(videoId ? { videoId } : {}),
      ...(format.itag != null ? { itag: format.itag } : {}),
    }),
  })

const readErrorResponse = (status: number) => {
  if (status === 413) return "This video is larger than Yohaku's 300 MB download limit."

  if (status === 429) return "Too many requests. Wait a minute and try again."

  if (status === 403 || status === 404) {
    return "The platform denied this public video request. It may be private or temporarily restricted."
  }

  return "The platform could not provide this video right now. Try again later."
}

const readResponse = async (
  response: Response,
  maxBytes: number,
  onProgress: (progress: number) => void,
): Promise<TransferResult> => {
  const contentLength = Number(response.headers.get("content-length") ?? 0)

  if (contentLength > maxBytes) return { ok: false, reason: "too-large" }

  if (!response.body) return { ok: false, reason: "unavailable" }

  const reader = response.body.getReader()
  const chunks: Array<Uint8Array<ArrayBuffer>> = []
  let received = 0

  while (true) {
    const { value, done } = await reader.read()

    if (done) break

    received += value.byteLength

    if (received > maxBytes) {
      await reader.cancel()

      return { ok: false, reason: "too-large" }
    }

    chunks.push(value as Uint8Array<ArrayBuffer>)
    onProgress(contentLength > 0 ? Math.min(1, received / contentLength) : 0)
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream"
  const blob = new Blob(chunks, { type: mimeType })

  return { ok: true, blob, bytes: received, mimeType }
}

const saveResponse = async (
  response: Response,
  handle: BrowserFileHandle,
  onProgress: (progress: number) => void,
): Promise<SaveResult> => {
  const contentLength = Number(response.headers.get("content-length") ?? 0)

  if (contentLength > MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES)
    return { ok: false as const, reason: "too-large" as const }
  if (!response.body) return { ok: false as const, reason: "unavailable" as const }

  const reader = response.body.getReader()
  const writer = await handle.createWritable()
  let received = 0

  try {
    while (true) {
      const { value, done } = await reader.read()

      if (done) break

      received += value.byteLength

      if (received > MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES) {
        await reader.cancel()
        await writer.abort?.()

        return { ok: false as const, reason: "too-large" as const }
      }

      await writer.write(value)
      onProgress(contentLength > 0 ? Math.min(1, received / contentLength) : 0)
    }

    await writer.close()

    return { ok: true as const, bytes: received }
  } catch (cause) {
    try {
      await writer.abort?.()
    } catch {
      return { ok: false, reason: isDownloadTooLarge(cause) ? "too-large" : "unavailable" }
    }

    return { ok: false, reason: isDownloadTooLarge(cause) ? "too-large" : "unavailable" }
  }
}

const mediaFileExtension = (mimeType: string, container: string | null | undefined) => {
  if (container === "WebM" || mimeType.includes("webm")) return "webm"
  if (container === "M4a" || mimeType.includes("audio/mp4")) return "m4a"

  return "mp4"
}

const mergeErrorMessage = (cause: unknown) => {
  switch (cause) {
    case "unsupported":
      return "This video's codecs cannot be combined in this browser."
    case "too-large":
      return "This video is too large to combine in the browser. Try a shorter video."
    case "worker":
      return "The video merge worker stopped unexpectedly. Try again."
    default:
      return "The video and audio streams could not be combined. Try again."
  }
}

const mergedSourceError = (reason: "too-large" | "unavailable") =>
  reason === "too-large"
    ? "This video is too large to combine in the browser. Try a shorter video."
    : "The video or audio stream was not available for this post."

const downloadMergedVideo = (
  request: SocialMediaDownloadRequest & {
    readonly merge: NonNullable<SocialMediaDownloadRequest["merge"]>
  },
  onProgress: (progress: DownloadProgress) => void,
): Effect.Effect<SocialMediaDownloadResult, SocialMediaDownloaderError> =>
  Effect.gen(function* () {
    const { video, audio, container } = request.merge
    const videoResponse = yield* Effect.tryPromise({
      try: () => downloadFormatResponse(video, request.platform, request.fileName, request.videoId),
      catch: () =>
        new SocialMediaDownloaderError({
          message: "Could not connect to the media download service. Try again in a moment.",
        }),
    })

    if (!videoResponse.ok) {
      return yield* new SocialMediaDownloaderError({
        message: readErrorResponse(videoResponse.status),
      })
    }

    const videoSource = yield* Effect.tryPromise({
      try: () =>
        readResponse(videoResponse, MAX_SOCIAL_MEDIA_MERGE_BYTES, (progress) =>
          onProgress({ phase: "download", progress: progress * 0.4 }),
        ),
      catch: () =>
        new SocialMediaDownloaderError({
          message: "The video download was interrupted. Check your connection and try again.",
        }),
    })

    if (!videoSource.ok) {
      return yield* new SocialMediaDownloaderError({
        message: mergedSourceError(videoSource.reason),
      })
    }

    const audioResponse = yield* Effect.tryPromise({
      try: () => downloadFormatResponse(audio, request.platform, request.fileName, request.videoId),
      catch: () =>
        new SocialMediaDownloaderError({
          message: "Could not connect to the media download service. Try again in a moment.",
        }),
    })

    if (!audioResponse.ok) {
      return yield* new SocialMediaDownloaderError({
        message: readErrorResponse(audioResponse.status),
      })
    }

    const audioSource = yield* Effect.tryPromise({
      try: () =>
        readResponse(audioResponse, MAX_SOCIAL_MEDIA_MERGE_BYTES, (progress) =>
          onProgress({ phase: "download", progress: 0.4 + progress * 0.4 }),
        ),
      catch: () =>
        new SocialMediaDownloaderError({
          message: "The audio download was interrupted. Check your connection and try again.",
        }),
    })

    if (!audioSource.ok) {
      return yield* new SocialMediaDownloaderError({
        message: mergedSourceError(audioSource.reason),
      })
    }

    if (videoSource.bytes + audioSource.bytes > MAX_SOCIAL_MEDIA_MERGE_BYTES) {
      return yield* new SocialMediaDownloaderError({
        message: mergedSourceError("too-large"),
      })
    }

    const bytes = yield* Effect.tryPromise({
      try: () =>
        mergeInWorker(videoSource.blob, audioSource.blob, container, (progress) =>
          onProgress({ phase: "merge", progress: 0.8 + progress * 0.2 }),
        ),
      catch: (cause) => new SocialMediaDownloaderError({ message: mergeErrorMessage(cause) }),
    })
    const blob = new Blob([bytes], { type: container === "webm" ? "video/webm" : "video/mp4" })
    const inputBytes = videoSource.bytes + audioSource.bytes
    const saveHandle = request.saveHandle

    if (saveHandle) {
      const saved = yield* Effect.tryPromise({
        try: async () => {
          const writer = await saveHandle.createWritable()

          try {
            await writer.write(new Uint8Array(bytes))
            await writer.close()
          } catch (cause) {
            try {
              await writer.abort?.()
            } catch {
              // The writer is already unusable.
            }

            throw cause
          }

          return bytes.byteLength
        },
        catch: () =>
          new SocialMediaDownloaderError({
            message:
              "Could not save this video to the selected location. Choose another location and retry.",
          }),
      })

      return { kind: "saved", fileName: request.fileName, outputBytes: saved }
    }

    return {
      kind: "file",
      blob,
      fileName: request.fileName,
      inputBytes,
      outputBytes: blob.size,
    }
  })

export const downloadSocialMedia = (
  request: SocialMediaDownloadRequest,
  onProgress: (progress: DownloadProgress) => void,
): Effect.Effect<SocialMediaDownloadResult, SocialMediaDownloaderError | VideoToMp3Error> =>
  Effect.gen(function* () {
    if (request.merge) {
      return yield* downloadMergedVideo({ ...request, merge: request.merge }, onProgress)
    }

    const response = yield* Effect.tryPromise({
      try: () =>
        downloadFormatResponse(request.format, request.platform, request.fileName, request.videoId),
      catch: () =>
        new SocialMediaDownloaderError({
          message: "Could not connect to the media download service. Try again in a moment.",
        }),
    })

    if (!response.ok) {
      return yield* new SocialMediaDownloaderError({ message: readErrorResponse(response.status) })
    }

    if (request.mode === "video" && request.saveHandle) {
      const saved = yield* Effect.tryPromise({
        try: () =>
          saveResponse(response, request.saveHandle!, (progress) =>
            onProgress({
              phase: "download",
              progress,
            }),
          ),
        catch: (cause) =>
          new SocialMediaDownloaderError({
            message: isDownloadTooLarge(cause)
              ? "This video is larger than Yohaku's 300 MB download limit."
              : "Could not save this video to the selected location. Choose another location and retry.",
          }),
      })

      if (!saved.ok) {
        return yield* new SocialMediaDownloaderError({
          message: "This video is larger than Yohaku's 300 MB download limit.",
        })
      }

      return { kind: "saved", fileName: request.fileName, outputBytes: saved.bytes }
    }

    const source = yield* Effect.tryPromise({
      try: () =>
        readResponse(response, MAX_SOCIAL_MEDIA_AUDIO_BYTES, (progress) =>
          onProgress({
            phase: "download",
            progress,
          }),
        ),
      catch: (cause) =>
        new SocialMediaDownloaderError({
          message: isDownloadTooLarge(cause)
            ? `This media is too large to process in browser memory. The limit is ${MAX_SOCIAL_MEDIA_AUDIO_BYTES / 1024 / 1024} MB.`
            : "The video download was interrupted. Check your connection and try again.",
        }),
    })

    if (!source.ok) {
      return yield* new SocialMediaDownloaderError({
        message:
          source.reason === "too-large"
            ? `This media is too large to process in browser memory. The limit is ${MAX_SOCIAL_MEDIA_AUDIO_BYTES / 1024 / 1024} MB.`
            : "The platform did not return a media stream for this video.",
      })
    }

    if (request.mode === "video") {
      return {
        kind: "file",
        blob: source.blob,
        fileName: request.fileName,
        inputBytes: source.bytes,
        outputBytes: source.blob.size,
      }
    }

    const inputName = `${request.fileName.replace(/\.mp3$/i, "")}.${mediaFileExtension(source.mimeType, request.format.container)}`
    const inputFile = new File([source.blob], inputName, { type: source.mimeType })
    const converted = yield* Effect.tryPromise({
      try: () =>
        convertVideoToMp3(inputFile, (progress) => onProgress({ phase: "convert", progress })),
      catch: (cause) =>
        cause instanceof VideoToMp3Error
          ? cause
          : new SocialMediaDownloaderError({
              message: "The audio stream could not be converted to MP3 in this browser.",
            }),
    })

    return {
      kind: "file",
      blob: converted.blob,
      fileName: `${request.fileName.replace(/\.mp3$/i, "")}.mp3`,
      inputBytes: source.bytes,
      outputBytes: converted.outputBytes,
    }
  })

export const resolveSocialMediaEffect = (url: string) => runEffect(resolveSocialMedia(url))

export const downloadSocialMediaEffect = (
  request: SocialMediaDownloadRequest,
  onProgress: (progress: DownloadProgress) => void,
) => runEffect(downloadSocialMedia(request, onProgress))
