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
    return { ok: false, message: "Paste a YouTube or Instagram video link." }
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    return { ok: false, message: "That link is not a valid URL." }
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return { ok: false, message: "Use a public HTTPS link from YouTube or Instagram." }
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

  return { ok: false, message: "Only YouTube and Instagram links are supported." }
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
