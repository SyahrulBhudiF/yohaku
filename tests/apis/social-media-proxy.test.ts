import { describe, expect, it, vi } from "vitest"

import {
  MAX_SOCIAL_MEDIA_CONTROL_BYTES,
  MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES,
} from "@/libs/schemas/social-media"
import { handleMediaDownloadProxy, handleMediaResolveProxy } from "@/apis/social-media-proxy.server"

const origin = "https://yohaku.example"

describe("social media proxy", () => {
  it("rejects cross-origin requests before contacting an upstream host", async () => {
    const fetcher = vi.fn<() => Promise<Response>>(async () => new Response("unexpected"))
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent("https://www.youtube.com/watch?v=abc123")}`,
      {
        headers: { origin: "https://attacker.invalid" },
      },
    )

    const response = await handleMediaResolveProxy(request, fetcher)

    expect(response.status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("rejects lookalike hosts and credentials in upstream URLs", async () => {
    const fetcher = vi.fn<() => Promise<Response>>(async () => new Response("unexpected"))
    const target = "https://youtube.com.attacker.invalid/watch?v=abc123"
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent(target)}`,
      { headers: { origin } },
    )

    expect((await handleMediaResolveProxy(request, fetcher)).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("strips browser credentials and forwards only allowlisted resolver headers", async () => {
    let upstreamHeaders: Headers | undefined
    const fetcher = async (_url: string, init: RequestInit) => {
      upstreamHeaders = new Headers(init.headers)

      return new Response("metadata", { headers: { "content-type": "text/plain" } })
    }
    const target = "https://www.youtube.com/watch?v=abc123"
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent(target)}`,
      {
        headers: {
          origin,
          cookie: "session=secret",
          authorization: "Bearer secret",
          "x-goog-api-key": "allowed-platform-key",
          "x-forwarded-for": "203.0.113.1",
        },
      },
    )

    const response = await handleMediaResolveProxy(request, fetcher)

    expect(response.status).toBe(200)
    expect(upstreamHeaders?.get("cookie")).toBeNull()
    expect(upstreamHeaders?.get("authorization")).toBeNull()
    expect(upstreamHeaders?.get("x-forwarded-for")).toBeNull()
    expect(upstreamHeaders?.get("x-goog-api-key")).toBe("allowed-platform-key")
    expect(upstreamHeaders?.get("referer")).toBe("https://www.youtube.com/")
  })

  it("uses the Facebook origin for Facebook control requests", async () => {
    let upstreamHeaders: Headers | undefined
    const fetcher = async (_url: string, init: RequestInit) => {
      upstreamHeaders = new Headers(init.headers)

      return new Response("metadata", { headers: { "content-type": "text/html" } })
    }
    const target = "https://www.facebook.com/watch/?v=10153231379946729"
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent(target)}`,
      { headers: { origin } },
    )

    const response = await handleMediaResolveProxy(request, fetcher)

    expect(response.status).toBe(200)
    expect(upstreamHeaders?.get("referer")).toBe("https://www.facebook.com/")
    expect(upstreamHeaders?.get("origin")).toBe("https://www.facebook.com")
  })

  it("serves control responses as inert text instead of upstream HTML", async () => {
    const fetcher = async () =>
      new Response("<html><script>alert(1)</script></html>", {
        headers: { "content-type": "text/html" },
      })
    const target = "https://www.facebook.com/login"
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent(target)}`,
      { headers: { origin } },
    )

    const response = await handleMediaResolveProxy(request, fetcher)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    expect(response.headers.get("content-disposition")).toBe("attachment")
    expect(response.headers.get("content-security-policy")).toBe("sandbox")
    expect(await response.text()).toContain("<html>")
  })

  it("streams Facebook CDN media with the Facebook origin", async () => {
    let upstreamHeaders: Headers | undefined
    const fetcher = async (_url: string, init: RequestInit) => {
      upstreamHeaders = new Headers(init.headers)

      return new Response(new Uint8Array([1, 2]), {
        headers: { "content-length": "2", "content-type": "video/mp4" },
      })
    }
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://video.xx.fbcdn.net/o1/v/t2/f2/m412/sample.mp4",
        platform: "facebook",
        fileName: "sample.mp4",
        headers: [],
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)

    expect(response.status).toBe(200)
    expect(upstreamHeaders?.get("referer")).toBe("https://www.facebook.com/")
    expect(upstreamHeaders?.get("origin")).toBe("https://www.facebook.com")
  })

  it("does not forward a stale content length on control responses", async () => {
    const body = JSON.stringify({ result: "complete".repeat(40) })
    const fetcher = async () =>
      new Response(body, {
        headers: { "content-length": "32", "content-type": "application/json" },
      })
    const target = "https://www.youtube.com/watch?v=abc123"
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent(target)}`,
      { headers: { origin } },
    )

    const response = await handleMediaResolveProxy(request, fetcher)

    expect(response.headers.get("content-length")).toBeNull()
    expect(await response.text()).toBe(body)
  })

  it("blocks redirects outside the media host allowlist", async () => {
    const fetcher = vi.fn<() => Promise<Response>>(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://attacker.invalid/collect" },
        }),
    )
    const target = "https://www.youtube.com/watch?v=abc123"
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent(target)}`,
      { headers: { origin } },
    )

    const response = await handleMediaResolveProxy(request, fetcher)

    expect(response.status).toBe(502)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("streams allowlisted media and sanitizes the download filename", async () => {
    const fetcher = async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { "content-length": "4", "content-type": "video/mp4" },
      })
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://rr.googlevideo.com/videoplayback?id=1",
        platform: "youtube",
        fileName: "../draft\r\n.mp4",
        headers: [
          { name: "cookie", value: "secret" },
          { name: "user-agent", value: "Yohaku test agent" },
        ],
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toContain('filename="-draft--.mp4"')
    expect(response.headers.get("content-type")).toBe("video/mp4")
    expect(response.headers.get("x-yohaku-final-url")).toBe(
      "https://rr.googlevideo.com/videoplayback?id=1",
    )
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3, 4])
  })

  it("forces non-media download responses to an inert octet-stream", async () => {
    const fetcher = async () =>
      new Response("<html><script>alert(1)</script></html>", {
        headers: { "content-type": "text/html" },
      })
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://rr.googlevideo.com/videoplayback?id=1",
        platform: "youtube",
        fileName: "video.mp4",
        headers: [],
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/octet-stream")
    expect(response.headers.get("content-disposition")).toContain("attachment")
  })

  it("cuts off a control body that exceeds the stream cap", async () => {
    const body = new Uint8Array(MAX_SOCIAL_MEDIA_CONTROL_BYTES + 1)
    const fetcher = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(body)
            controller.close()
          },
        }),
        { headers: { "content-type": "application/json" } },
      )
    const target = "https://www.youtube.com/watch?v=abc123"
    const request = new Request(
      `${origin}/api/media/resolve-proxy?url=${encodeURIComponent(target)}`,
      { headers: { origin } },
    )

    const response = await handleMediaResolveProxy(request, fetcher)

    expect(response.status).toBe(200)
    await expect(response.arrayBuffer()).rejects.toBeTruthy()
  })

  it("rejects media above the stream limit before returning its body", async () => {
    const fetcher = async () =>
      new Response(null, {
        headers: { "content-length": String(MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES + 1) },
      })
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://rr.googlevideo.com/videoplayback?id=1",
        platform: "youtube",
        fileName: "large.mp4",
        headers: [],
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)

    expect(response.status).toBe(413)
  })

  it("re-resolves a YouTube format inside the download request when the stale URL is denied", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetcher = async (url: string, init: RequestInit) => {
      calls.push({ url, init })

      if (init.method === "POST") {
        return new Response(
          JSON.stringify({
            streamingData: {
              adaptiveFormats: [
                { itag: 137, url: "https://rr.googlevideo.com/videoplayback?id=fresh" },
              ],
            },
          }),
          { headers: { "content-type": "application/json" } },
        )
      }

      if (url.includes("stale")) return new Response("denied", { status: 403 })

      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 206,
        headers: {
          "content-range": "bytes 0-3/4",
          "content-type": "video/mp4",
        },
      })
    }
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://rr.googlevideo.com/videoplayback?id=stale",
        platform: "youtube",
        fileName: "video.mp4",
        headers: [],
        videoId: "w5wNu69O2KA",
        itag: 137,
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)

    expect(response.status).toBe(200)
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3, 4])
    expect(new Headers(calls[0]?.init.headers).get("range")).toBe("bytes=0-8388607")
    expect(calls[1]?.url).toContain("/youtubei/v1/player")
    expect(calls[1]?.init.method).toBe("POST")
    expect(new Headers(calls[1]?.init.headers).has("x-youtube-client-name")).toBe(true)
    expect(JSON.parse(calls[1]?.init.body as string)).toMatchObject({
      videoId: "w5wNu69O2KA",
    })
    expect(calls[2]?.url).toBe("https://rr.googlevideo.com/videoplayback?id=fresh")
    expect(new Headers(calls[2]?.init.headers).get("range")).toBe("bytes=0-8388607")
  })

  it("does not ask YouTube for a fresh URL when the video id is invalid", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response("denied", { status: 403 }),
    )
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://rr.googlevideo.com/videoplayback?id=stale",
        platform: "youtube",
        fileName: "video.mp4",
        headers: [],
        videoId: "not-a-video-id",
        itag: 137,
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)

    expect(response.status).toBe(403)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("streams the rest of a media file with bounded ranges", async () => {
    const total = 8 * 1024 * 1024 + 1
    const calls: Array<string | null> = []
    const fetcher = async (_url: string, init: RequestInit) => {
      const range = new Headers(init.headers).get("range")

      calls.push(range)

      if (range === "bytes=0-8388607") {
        return new Response(new Uint8Array(8 * 1024 * 1024), {
          status: 206,
          headers: {
            "content-range": `bytes 0-8388607/${total}`,
            "content-type": "video/mp4",
          },
        })
      }

      return new Response(new Uint8Array([9]), {
        status: 206,
        headers: {
          "content-range": `bytes 8388608-8388608/${total}`,
          "content-type": "video/mp4",
        },
      })
    }
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://rr.googlevideo.com/videoplayback?id=1",
        platform: "youtube",
        fileName: "video.mp4",
        headers: [],
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)
    const body = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-length")).toBe(String(total))
    expect(body.byteLength).toBe(total)
    expect(body[total - 1]).toBe(9)
    expect(calls).toEqual(["bytes=0-8388607", "bytes=8388608-8388608"])
  })

  it("rejects a ranged media response whose total exceeds the stream limit", async () => {
    const fetcher = async () =>
      new Response(new Uint8Array([1]), {
        status: 206,
        headers: {
          "content-range": `bytes 0-0/${MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES + 1}`,
          "content-type": "video/mp4",
        },
      })
    const request = new Request(`${origin}/api/media/download`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://rr.googlevideo.com/videoplayback?id=1",
        platform: "youtube",
        fileName: "large.mp4",
        headers: [],
      }),
    })

    const response = await handleMediaDownloadProxy(request, fetcher)

    expect(response.status).toBe(413)
  })
})
