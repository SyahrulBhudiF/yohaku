import { Option, Schema } from "effect"

import {
  MAX_SOCIAL_MEDIA_URL_LENGTH,
  SocialMediaInfoSchema,
  type SocialMediaFormat,
  type SocialMediaInfo,
  type SocialMediaPlatform,
} from "@/libs/schemas/social-media"

export type SocialMediaUrlResult =
  | { readonly ok: true; readonly url: string; readonly platform: SocialMediaPlatform }
  | { readonly ok: false; readonly message: string }

const isHostOrSubdomain = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`)

export const parseSocialMediaUrl = (input: string): SocialMediaUrlResult => {
  const value = input.trim()

  if (!value || value.length > MAX_SOCIAL_MEDIA_URL_LENGTH) {
    return { ok: false, message: "Paste a YouTube, Instagram, or Facebook video link." }
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    return { ok: false, message: "That link is not a valid URL." }
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return { ok: false, message: "Use a public HTTPS link from YouTube, Instagram, or Facebook." }
  }

  const host = url.hostname.toLowerCase()

  if (
    host === "youtu.be" ||
    isHostOrSubdomain(host, "youtube.com") ||
    isHostOrSubdomain(host, "youtube-nocookie.com")
  ) {
    const segments = url.pathname.split("/").filter(Boolean)
    const videoId =
      host === "youtu.be"
        ? segments[0]
        : url.pathname === "/watch"
          ? url.searchParams.get("v")
          : ["shorts", "embed", "live", "v"].includes(segments[0] ?? "")
            ? segments[1]
            : null

    if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return { ok: false, message: "Use a direct YouTube video or Shorts link, not a playlist." }
    }

    const canonical = new URL("https://www.youtube.com/watch")

    canonical.searchParams.set("v", videoId)

    return { ok: true, url: canonical.toString(), platform: "youtube" }
  }

  if (isHostOrSubdomain(host, "instagram.com")) {
    const segments = url.pathname.split("/").filter(Boolean)
    const postIndex = segments.findIndex((segment) =>
      ["p", "reel", "reels", "tv"].includes(segment),
    )
    const isShareUrl = segments[0] === "share"

    if (!isShareUrl && (postIndex < 0 || !segments[postIndex + 1])) {
      return { ok: false, message: "Use a public Instagram post or Reel link." }
    }

    url.search = ""
    url.hash = ""

    return { ok: true, url: url.toString(), platform: "instagram" }
  }

  if (host === "fb.watch" || isHostOrSubdomain(host, "facebook.com")) {
    return parseFacebookUrl(url)
  }

  return { ok: false, message: "Only YouTube, Instagram, and Facebook links are supported." }
}

const FACEBOOK_VIDEO_ID = /^\d{5,25}$/

const facebookVideoId = (url: URL): string | null => {
  const segments = url.pathname.split("/").filter(Boolean)
  const numeric = (value: string | undefined) =>
    value && FACEBOOK_VIDEO_ID.test(value) ? value : null

  if (segments[0] === "watch" || segments[0] === "video.php") {
    return numeric(url.searchParams.get("v") ?? undefined)
  }

  if (segments[0] === "video" && segments[1] === "video.php") {
    return numeric(url.searchParams.get("v") ?? undefined)
  }

  if (segments[0] === "reel") {
    return numeric(segments[1])
  }

  const videosIndex = segments.indexOf("videos")

  if (videosIndex > 0) {
    return (
      segments
        .slice(videosIndex + 1)
        .reverse()
        .map((segment) => numeric(segment))
        .find((id) => id !== null) ?? null
    )
  }

  return null
}

const parseFacebookUrl = (url: URL): SocialMediaUrlResult => {
  const segments = url.pathname.split("/").filter(Boolean)
  const isShortLink = url.hostname.toLowerCase() === "fb.watch"
  const isShareLink = segments[0] === "share" && ["v", "r"].includes(segments[1] ?? "")

  if (isShortLink) {
    if (!segments[0]) {
      return { ok: false, message: "Use a direct Facebook video, Reel, or share link." }
    }

    url.hostname = "fb.watch"
    url.search = ""
    url.hash = ""

    return { ok: true, url: url.toString(), platform: "facebook" }
  }

  if (isShareLink) {
    if (!segments[2]) {
      return { ok: false, message: "Use a direct Facebook video, Reel, or share link." }
    }

    url.hostname = "www.facebook.com"
    url.search = ""
    url.hash = ""

    return { ok: true, url: url.toString(), platform: "facebook" }
  }

  const videoId = facebookVideoId(url)

  if (!videoId) {
    return { ok: false, message: "Use a direct Facebook video or Reel link." }
  }

  const videosIndex = segments.indexOf("videos")

  if (videosIndex > 0) {
    return {
      ok: true,
      url: `https://www.facebook.com/${segments[0]}/videos/${videoId}/`,
      platform: "facebook",
    }
  }

  return {
    ok: true,
    url: `https://www.facebook.com/watch/?v=${videoId}`,
    platform: "facebook",
  }
}

export const decodeSocialMediaInfo = (input: unknown): SocialMediaInfo | null => {
  const decoded = Schema.decodeUnknownOption(SocialMediaInfoSchema)(input)

  return Option.isSome(decoded) ? decoded.value : null
}

export const getSocialMediaEmbedUrl = (
  platform: SocialMediaPlatform,
  webpageUrl: string,
): string | null => {
  const parsed = parseSocialMediaUrl(webpageUrl)

  if (!parsed.ok || parsed.platform !== platform) return null

  if (platform === "youtube") {
    const videoId = new URL(parsed.url).searchParams.get("v")

    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null
  }

  if (platform === "facebook") {
    const url = new URL(parsed.url)
    const isVideoPage =
      url.pathname === "/watch/" ||
      url.pathname === "/watch" ||
      /^\/[^/]+\/videos\/\d+\/?$/.test(url.pathname) ||
      /^\/reel\/\d+\/?$/.test(url.pathname)

    return isVideoPage
      ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false`
      : null
  }

  const url = new URL(parsed.url)
  const segments = url.pathname.split("/").filter(Boolean)
  const postIndex = segments.findIndex((segment) => ["p", "reel", "reels", "tv"].includes(segment))
  const postType = segments[postIndex]
  const shortcode = segments[postIndex + 1]

  if (!postType || !shortcode) return null

  return `https://www.instagram.com/${postType}/${encodeURIComponent(shortcode)}/embed/`
}

const isSupportedMediaUrl = (value: string) => {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (isHostOrSubdomain(host, "youtube.com") ||
        isHostOrSubdomain(host, "youtube-nocookie.com") ||
        host === "youtu.be" ||
        isHostOrSubdomain(host, "youtubei.googleapis.com") ||
        isHostOrSubdomain(host, "googlevideo.com") ||
        isHostOrSubdomain(host, "ytimg.com") ||
        isHostOrSubdomain(host, "instagram.com") ||
        isHostOrSubdomain(host, "cdninstagram.com") ||
        isHostOrSubdomain(host, "facebook.com") ||
        host === "fb.watch" ||
        isHostOrSubdomain(host, "fbcdn.net") ||
        isHostOrSubdomain(host, "fbsbx.com"))
    )
  } catch {
    return false
  }
}

const hasStream = (format: SocialMediaFormat, stream: "audio" | "video") =>
  format[stream] != null && isSupportedMediaUrl(format.url)

const videoRank = (format: SocialMediaFormat) => [
  format.video?.height ?? 0,
  format.video?.fps ?? 0,
  format.bitrate ?? 0,
]

const audioRank = (format: SocialMediaFormat) => [
  format.audio?.bitrate ?? format.bitrate ?? 0,
  format.audio?.sample_rate ?? 0,
]

const compareRank = (left: ReadonlyArray<number>, right: ReadonlyArray<number>) => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)

    if (difference !== 0) return difference
  }

  return 0
}

export const selectProgressiveVideo = (info: SocialMediaInfo) =>
  [...info.formats]
    .filter((format) => hasStream(format, "video") && hasStream(format, "audio"))
    .sort((left, right) => {
      const mp4Preference = Number(right.container === "Mp4") - Number(left.container === "Mp4")

      return mp4Preference || compareRank(videoRank(left), videoRank(right)) * -1
    })[0] ?? null

export const selectAudioSource = (info: SocialMediaInfo) =>
  [...info.formats]
    .filter((format) => hasStream(format, "audio"))
    .sort((left, right) => compareRank(audioRank(left), audioRank(right)) * -1)[0] ?? null

export interface MergedVideo {
  readonly video: SocialMediaFormat
  readonly audio: SocialMediaFormat
  readonly container: "mp4" | "webm"
}

type VideoFamily = "avc" | "hevc" | "vp8" | "vp9" | "av1"
type AudioFamily = "aac" | "mp3" | "opus" | "vorbis"

const videoFamily = (codec: string): VideoFamily | null => {
  const value = codec.toLowerCase()

  if (value.includes("avc") || value.includes("h264")) return "avc"
  if (value.includes("hev") || value.includes("hvc") || value.includes("h265")) return "hevc"
  if (value.includes("vp9") || value.includes("vp09")) return "vp9"
  if (value.includes("vp8")) return "vp8"
  if (value.includes("av1") || value.includes("av01")) return "av1"

  return null
}

const audioFamily = (codec: string): AudioFamily | null => {
  const value = codec.toLowerCase()

  if (value.includes("mp4a") || value.includes("aac")) return "aac"
  if (value.includes("opus")) return "opus"
  if (value.includes("vorbis")) return "vorbis"
  if (value.includes("mp3")) return "mp3"

  return null
}

const mergedContainer = (
  video: VideoFamily,
  audio: AudioFamily,
): MergedVideo["container"] | null => {
  if (["vp8", "vp9", "av1"].includes(video) && ["opus", "vorbis"].includes(audio)) {
    return "webm"
  }

  if (
    ["avc", "hevc", "av1", "vp8", "vp9"].includes(video) &&
    ["aac", "mp3", "opus", "vorbis"].includes(audio)
  ) {
    return "mp4"
  }

  return null
}

/**
 * Picks a video-only and audio-only pair for a browser-side merge when the
 * provider does not offer a progressive stream.
 */
export const selectMergedVideo = (info: SocialMediaInfo): MergedVideo | null => {
  const videos = info.formats
    .filter(
      (format) => format.video != null && format.audio == null && isSupportedMediaUrl(format.url),
    )
    .sort((left, right) => compareRank(videoRank(left), videoRank(right)) * -1)
  const audios = info.formats
    .filter(
      (format) => format.audio != null && format.video == null && isSupportedMediaUrl(format.url),
    )
    .sort((left, right) => compareRank(audioRank(left), audioRank(right)) * -1)

  for (const video of videos) {
    const videoKind = videoFamily(video.video?.codec ?? "")

    if (!videoKind) continue

    const preferredAudio: ReadonlyArray<AudioFamily> =
      videoKind === "avc" || videoKind === "hevc" ? ["aac", "mp3"] : ["opus", "vorbis"]
    const candidates = audios.flatMap((audio) => {
      const audioKind = audioFamily(audio.audio?.codec ?? "")
      const container = audioKind ? mergedContainer(videoKind, audioKind) : null

      return container ? [{ audio, audioKind, container }] : []
    })

    if (candidates.length === 0) continue

    const [first] = candidates

    if (!first) continue

    const choice =
      candidates.find(
        (candidate) => candidate.audioKind != null && preferredAudio.includes(candidate.audioKind),
      ) ?? first

    return { video, audio: choice.audio, container: choice.container }
  }

  return null
}

export const mediaFileStem = (title: string) => {
  const normalized = title.normalize("NFKC")
  const stem = Array.from(normalized, (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    const isControl = codePoint < 32 || (codePoint >= 127 && codePoint <= 159)
    const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff

    return isControl || isSurrogate || /[<>:"/\\|?*]/.test(character) ? " " : character
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)

  return stem || "video"
}

export const formatDuration = (duration: SocialMediaInfo["duration"]) => {
  if (!duration) return null

  const seconds = duration.secs + duration.nanos / 1_000_000_000
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}
