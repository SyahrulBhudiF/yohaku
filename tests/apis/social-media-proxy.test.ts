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
})
