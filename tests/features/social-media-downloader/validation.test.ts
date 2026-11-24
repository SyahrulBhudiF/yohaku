import { describe, expect, it } from "vitest"

import {
  decodeSocialMediaInfo,
  formatDuration,
  getSocialMediaEmbedUrl,
  mediaFileStem,
  parseSocialMediaUrl,
  selectAudioSource,
  selectProgressiveVideo,
} from "@/features/social-media-downloader/validation"
import type { SocialMediaFormat, SocialMediaInfo } from "@/libs/schemas/social-media"

const makeFormat = (overrides: Partial<SocialMediaFormat>): SocialMediaFormat => ({
  url: "https://rr.googlevideo.com/videoplayback?id=1",
  mime_type: "video/mp4",
  container: "Mp4",
  filesize: 1_000,
  bitrate: 1_000,
  http_headers: [],
  video: { width: 1280, height: 720, fps: 30, codec: "avc1" },
  audio: { codec: "mp4a", bitrate: 128_000, sample_rate: 48_000, channels: 2 },
  ...overrides,
})

const makeInfo = (formats: SocialMediaFormat[]): SocialMediaInfo => ({
  id: "video-id",
  title: "Sample video",
  description: null,
  duration: { secs: 61, nanos: 0 },
  uploader: "Creator",
  webpage_url: "https://www.youtube.com/watch?v=video-id",
  is_live: false,
  formats,
})

describe("parseSocialMediaUrl", () => {
  it("canonicalizes supported YouTube URLs and keeps only the video ID", () => {
    expect(parseSocialMediaUrl("https://youtu.be/abc123_XY?si=tracking")).toEqual({
      ok: true,
      url: "https://www.youtube.com/watch?v=abc123_XY",
      platform: "youtube",
    })
  })

  it("accepts public Instagram Reels and removes tracking data", () => {
    expect(
      parseSocialMediaUrl("https://www.instagram.com/reel/AbC123/?igsh=tracking#clip"),
    ).toEqual({
      ok: true,
      url: "https://www.instagram.com/reel/AbC123/",
      platform: "instagram",
    })
  })

  it("canonicalizes public Facebook videos, Reels, share links, and fb.watch links", () => {
    expect(
      parseSocialMediaUrl("https://www.facebook.com/watch/?v=10153231379946729&ref=share"),
    ).toEqual({
      ok: true,
      url: "https://www.facebook.com/watch/?v=10153231379946729",
      platform: "facebook",
    })
    expect(
      parseSocialMediaUrl(
        "https://www.facebook.com/facebook/videos/how-to-share/10153231379946729/",
      ),
    ).toEqual({
      ok: true,
      url: "https://www.facebook.com/facebook/videos/10153231379946729/",
      platform: "facebook",
    })
    expect(parseSocialMediaUrl("https://www.facebook.com/reel/1195289147628387")).toEqual({
      ok: true,
      url: "https://www.facebook.com/watch/?v=1195289147628387",
      platform: "facebook",
    })
    expect(parseSocialMediaUrl("https://fb.watch/abc123/?ref=share")).toEqual({
      ok: true,
      url: "https://fb.watch/abc123/",
      platform: "facebook",
    })
    expect(parseSocialMediaUrl("https://www.facebook.com/share/v/abc123/?ref=share")).toEqual({
      ok: true,
      url: "https://www.facebook.com/share/v/abc123/",
      platform: "facebook",
    })
  })

  it("rejects Facebook profile pages and lookalike hosts", () => {
    expect(parseSocialMediaUrl("https://www.facebook.com/some.page/").ok).toBe(false)
    expect(parseSocialMediaUrl("https://facebook.com.attacker.invalid/watch?v=123456").ok).toBe(
      false,
    )
  })

  it("rejects lookalike hosts, credentials, and non-HTTPS URLs", () => {
    expect(parseSocialMediaUrl("https://youtube.com.attacker.invalid/watch?v=abc123").ok).toBe(
      false,
    )
    expect(parseSocialMediaUrl("https://user:pass@youtube.com/watch?v=abc123").ok).toBe(false)
    expect(parseSocialMediaUrl("http://youtube.com/watch?v=abc123").ok).toBe(false)
  })

  it("rejects playlists and non-video Instagram pages", () => {
    expect(parseSocialMediaUrl("https://www.youtube.com/playlist?list=PL123456").ok).toBe(false)
    expect(parseSocialMediaUrl("https://www.instagram.com/some.creator/").ok).toBe(false)
  })

  it("builds provider preview URLs only from supported public video links", () => {
    expect(getSocialMediaEmbedUrl("youtube", "https://www.youtube.com/watch?v=abc123_XY")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123_XY",
    )
    expect(getSocialMediaEmbedUrl("instagram", "https://www.instagram.com/reel/AbC123/")).toBe(
      "https://www.instagram.com/reel/AbC123/embed/",
    )
    expect(getSocialMediaEmbedUrl("youtube", "https://www.instagram.com/reel/AbC123/")).toBeNull()
    expect(
      getSocialMediaEmbedUrl("instagram", "https://www.instagram.com/share/abc123/"),
    ).toBeNull()
    expect(
      getSocialMediaEmbedUrl("facebook", "https://www.facebook.com/watch/?v=10153231379946729"),
    ).toBe(
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D10153231379946729&show_text=false",
    )
    expect(
      getSocialMediaEmbedUrl("facebook", "https://www.facebook.com/share/v/abc123/"),
    ).toBeNull()
  })
})

describe("media selection and labels", () => {
  it("decodes Rust metadata when optional stream details are omitted", () => {
    const format = makeFormat({
      filesize: undefined,
      audio: { codec: "mp4a.40.2", sample_rate: 44_100, channels: 2 },
    })
    const info = makeInfo([format])
    const decoded = decodeSocialMediaInfo(JSON.parse(JSON.stringify(info)))

    expect(decoded).not.toBeNull()
    expect(decoded && selectProgressiveVideo(decoded)).not.toBeNull()
    expect(decoded && selectAudioSource(decoded)?.audio?.bitrate).toBeUndefined()
  })

  it("does not select a stream when Rust omits its optional media details", () => {
    const formats = [makeFormat({ audio: undefined, video: undefined })]

    expect(selectProgressiveVideo(makeInfo(formats))).toBeNull()
    expect(selectAudioSource(makeInfo(formats))).toBeNull()
  })

  it("chooses the highest-resolution progressive video and ignores unsafe URLs", () => {
    const formats = [
      makeFormat({ video: { width: 640, height: 360, fps: 30, codec: "avc1" } }),
      makeFormat({
        url: "https://googlevideo.com.attacker.invalid/video",
        video: { width: 3840, height: 2160, fps: 60, codec: "avc1" },
      }),
      makeFormat({ video: { width: 1920, height: 1080, fps: 30, codec: "avc1" } }),
    ]

    expect(selectProgressiveVideo(makeInfo(formats))?.video?.height).toBe(1080)
  })

  it("chooses the highest-bitrate audio source", () => {
    const formats = [
      makeFormat({ audio: { codec: "opus", bitrate: 96_000, sample_rate: 48_000, channels: 2 } }),
      makeFormat({ audio: { codec: "opus", bitrate: 160_000, sample_rate: 48_000, channels: 2 } }),
    ]

    expect(selectAudioSource(makeInfo(formats))?.audio?.bitrate).toBe(160_000)
  })

  it("formats durations and makes safe, useful filenames", () => {
    expect(formatDuration({ secs: 3_661, nanos: 0 })).toBe("61:01")
    expect(mediaFileStem("  My / Video: 2026?  ")).toBe("My Video 2026")
    expect(mediaFileStem("   ")).toBe("video")
  })
})
