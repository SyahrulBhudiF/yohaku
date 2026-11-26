import { Option, Schema } from "effect"

import {
  MAX_SOCIAL_MEDIA_CONTROL_BYTES,
  MAX_SOCIAL_MEDIA_CONTROL_REQUEST_BYTES,
  MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES,
  SocialMediaDownloadRequestSchema,
  type SocialMediaDownloadRequest,
  type SocialMediaPlatform,
} from "@/libs/schemas/social-media"

const MEDIA_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "youtubei.googleapis.com",
  "googlevideo.com",
  "ytimg.com",
  "instagram.com",
  "cdninstagram.com",
  "facebook.com",
  "fb.watch",
  "fbcdn.net",
  "fbsbx.com",
] as const

const SAFE_UPSTREAM_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "range",
  "referer",
  "origin",
  "user-agent",
  "x-asbd-id",
  "x-fb-lsd",
  "x-goog-api-key",
  "x-ig-app-id",
  "x-youtube-client-name",
  "x-youtube-client-version",
])

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 4
const UPSTREAM_TIMEOUT_MS = 30_000
const REQUEST_BODY_TIMEOUT_MS = 10_000
const UPSTREAM_BODY_IDLE_TIMEOUT_MS = 30_000
const MEDIA_RANGE_CHUNK_BYTES = 8 * 1024 * 1024

// YouTube binds googlevideo URLs to the IP that requested the player response.
// A Worker request can use a different egress IP from the request that resolved
// the video, so a stale URL answers 403. Re-resolve inside the download request
// and use the fresh URL there, where the player and media requests share the
// same outbound context.
const YOUTUBE_IOS_CLIENT = {
  name: "IOS",
  version: "20.10.4",
  nameId: 5,
  userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
  context: {
    deviceMake: "Apple",
    deviceModel: "iPhone16,2",
    osName: "iPhone",
    osVersion: "18.3.2.22D82",
  },
} as const

// IOS returns adaptive streams but not the progressive itag 18. Android is the
// fallback for progressive formats.
const YOUTUBE_ANDROID_CLIENT = {
  name: "ANDROID",
  version: "20.10.38",
  nameId: 3,
  userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
  context: {
    androidSdkVersion: 34,
    osName: "Android",
    osVersion: "14",
  },
} as const

const YOUTUBE_PLAYER_CLIENTS = [YOUTUBE_IOS_CLIENT, YOUTUBE_ANDROID_CLIENT] as const

type Fetcher = (url: string, init: RequestInit) => Promise<Response>
type ProxyKind = "control" | "download"

interface YoutubePlayerFormat {
  readonly itag?: number
  readonly url?: string
  readonly signatureCipher?: string
}

interface YoutubePlayerResponse {
  readonly streamingData?: {
    readonly formats?: ReadonlyArray<YoutubePlayerFormat>
    readonly adaptiveFormats?: ReadonlyArray<YoutubePlayerFormat>
  }
}

export const mediaProxyResponse = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })

const response = mediaProxyResponse

const isAllowedHost = (host: string) =>
  MEDIA_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))

const parseUpstreamUrl = (value: string | null) => {
  if (value === null || value.length > 8_192) return null

  try {
    const url = new URL(value)

    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      (url.port !== "" && url.port !== "443") ||
      !isAllowedHost(url.hostname.toLowerCase())
    ) {
      return null
    }

    return url
  } catch {
    return null
  }
}

export const isSameOriginRequest = (request: Request) => {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")

  return (
    (origin === null || origin === requestUrl.origin) &&
    (fetchSite === null || fetchSite === "same-origin" || fetchSite === "none")
  )
}

const isPlatformUrl = (value: string) => {
  const url = parseUpstreamUrl(value)

  if (!url) return false

  return isAllowedHost(url.hostname.toLowerCase())
}

const inferPlatform = (target: URL): SocialMediaPlatform => {
  const host = target.hostname.toLowerCase()

  if (host.includes("facebook") || host === "fb.watch" || host.includes("fbcdn")) return "facebook"
  if (host.includes("instagram") || host.includes("cdninstagram") || host.includes("fbsbx"))
    return "instagram"

  return "youtube"
}

const PLATFORM_ORIGINS: Record<SocialMediaPlatform, string> = {
  youtube: "https://www.youtube.com",
  instagram: "https://www.instagram.com",
  facebook: "https://www.facebook.com",
}

const platformOrigin = (platform: SocialMediaPlatform) => PLATFORM_ORIGINS[platform]

const requestHeaders = (source: Headers, platform?: SocialMediaPlatform) => {
  const headers = new Headers()

  for (const [name, value] of source) {
    if (SAFE_UPSTREAM_HEADERS.has(name.toLowerCase())) headers.set(name, value)
  }

  const referer = platform ? `${platformOrigin(platform)}/` : null
  const origin = platform ? platformOrigin(platform) : null

  if (referer) headers.set("referer", referer)
  if (origin) headers.set("origin", origin)

  return headers
}

const fetchAllowedTarget = async (
  target: URL,
  init: RequestInit,
  fetcher: Fetcher,
): Promise<Response | null> => {
  let currentUrl = target
  let currentInit = { ...init, redirect: "manual" as const }

  for (let count = 0; count <= MAX_REDIRECTS; count += 1) {
    const upstream = await fetcher(currentUrl.toString(), currentInit)

    if (!REDIRECT_STATUSES.has(upstream.status)) return upstream

    const location = upstream.headers.get("location")

    if (!location || count === MAX_REDIRECTS) {
      await upstream.body?.cancel()

      return null
    }

    let redirectedUrl: string

    try {
      redirectedUrl = new URL(location, currentUrl).toString()
    } catch {
      await upstream.body?.cancel()

      return null
    }

    const nextUrl = parseUpstreamUrl(redirectedUrl)

    if (!nextUrl) {
      await upstream.body?.cancel()

      return null
    }

    if (
      upstream.status === 303 ||
      ((upstream.status === 301 || upstream.status === 302) && currentInit.method === "POST")
    ) {
      const nextInit = { ...currentInit, method: "GET" }

      delete nextInit.body

      const nextHeaders = new Headers(nextInit.headers)

      nextHeaders.delete("content-type")

      nextInit.headers = nextHeaders
      currentInit = nextInit
    }

    await upstream.body?.cancel()
    currentUrl = nextUrl
  }

  return null
}

const bodyWithLimit = (body: ReadableStream<Uint8Array> | null, maxBytes: number) => {
  if (body === null) return null

  const reader = body.getReader()
  let receivedBytes = 0
  let finished = false
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  const fail = (controller: ReadableStreamDefaultController<Uint8Array>, message: string) => {
    if (finished) return

    finished = true
    clearIdleTimer()
    void reader.cancel().catch(() => undefined)
    controller.error(new DOMException(message, "TimeoutError"))
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return

      idleTimer = setTimeout(
        () => fail(controller, "The upstream media stopped responding."),
        UPSTREAM_BODY_IDLE_TIMEOUT_MS,
      )

      try {
        const chunk = await reader.read()

        clearIdleTimer()

        if (finished) return

        if (chunk.done) {
          finished = true
          controller.close()

          return
        }

        receivedBytes += chunk.value.byteLength

        if (receivedBytes > maxBytes) {
          finished = true
          await reader.cancel()
          controller.error(
            new DOMException(
              "The upstream media exceeded the download size limit.",
              "QuotaExceededError",
            ),
          )

          return
        }

        controller.enqueue(chunk.value)
      } catch (cause) {
        if (finished) return

        finished = true
        clearIdleTimer()
        controller.error(cause)
      }
    },
    cancel(reason) {
      finished = true
      clearIdleTimer()

      return reader.cancel(reason)
    },
  })
}

const readRequestBody = async (request: Request, maxBytes: number) => {
  const body = request.body

  if (!body) return new Uint8Array()

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    void reader.cancel().catch(() => undefined)
  }, REQUEST_BODY_TIMEOUT_MS)

  try {
    while (true) {
      const { value, done } = await reader.read()

      if (timedOut) return null

      if (done) break

      received += value.byteLength

      if (received > maxBytes) {
        await reader.cancel()

        return null
      }

      chunks.push(value)
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }

  if (timedOut) return null

  const result = new Uint8Array(received)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  return result
}

const readDownloadRequest = async (
  request: Request,
): Promise<SocialMediaDownloadRequest | null> => {
  const contentLength = Number(request.headers.get("content-length") ?? 0)

  if (contentLength > MAX_SOCIAL_MEDIA_CONTROL_REQUEST_BYTES) return null

  try {
    const bytes = await readRequestBody(request, MAX_SOCIAL_MEDIA_CONTROL_REQUEST_BYTES)

    if (!bytes) return null

    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    const decoded = Schema.decodeUnknownOption(SocialMediaDownloadRequestSchema)(body)

    return Option.isSome(decoded) ? decoded.value : null
  } catch {
    return null
  }
}

const safeFileName = (value: string) => {
  const clean = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    const isControl = codePoint < 32 || (codePoint >= 127 && codePoint <= 159)
    const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff

    return isControl || isSurrogate || /["\\/<>:|?*]/.test(character) ? "-" : character
  })
    .join("")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 150)

  return clean || "video.mp4"
}

const contentDisposition = (fileName: string) => {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  const encoded = encodeURIComponent(fileName)

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

const parseContentRangeTotal = (value: string | null) => {
  const match = value?.match(/^bytes \d+-\d+\/(\d+)$/)

  return match?.[1] ? Number(match[1]) : null
}

/**
 * Ask YouTube for a fresh direct URL for one format. The returned URL is bound
 * to the egress IP of this request, so the media fetch must happen in the same
 * request. The browser resolver remains the source of truth for metadata.
 */
const fetchYoutubeFormatUrl = async (
  videoId: string,
  itag: number,
  client: (typeof YOUTUBE_PLAYER_CLIENTS)[number],
  fetcher: Fetcher,
): Promise<string | null> => {
  const endpoint = "https://www.youtube.com/youtubei/v1/player"
  const body = JSON.stringify({
    videoId,
    context: {
      client: {
        clientName: client.name,
        clientVersion: client.version,
        hl: "en",
        gl: "US",
        ...client.context,
      },
    },
    contentCheckOk: true,
    racyCheckOk: true,
  })
  const headers = new Headers({
    "content-type": "application/json",
    "user-agent": client.userAgent,
    "x-youtube-client-name": String(client.nameId),
    "x-youtube-client-version": client.version,
    origin: "https://www.youtube.com",
    referer: "https://www.youtube.com/",
  })
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetchAllowedTarget(
      new URL(endpoint),
      {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      },
      fetcher,
    )

    if (!upstream) return null

    const declaredLength = Number(upstream.headers.get("content-length") ?? 0)

    if (!upstream.ok || declaredLength > MAX_SOCIAL_MEDIA_CONTROL_BYTES) {
      await upstream.body?.cancel()

      return null
    }

    const payload = (await upstream.json()) as YoutubePlayerResponse
    const formats = [
      ...(payload.streamingData?.formats ?? []),
      ...(payload.streamingData?.adaptiveFormats ?? []),
    ]
    const format = formats.find((candidate) => candidate.itag === itag)

    if (!format?.url || format.signatureCipher) return null

    const target = parseUpstreamUrl(format.url)

    return target ? target.toString() : null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

const resolveFreshYoutubeUrl = async (
  videoId: string,
  itag: number,
  fetcher: Fetcher,
): Promise<string | null> => {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !Number.isInteger(itag) || itag <= 0) {
    return null
  }

  for (const client of YOUTUBE_PLAYER_CLIENTS) {
    const url = await fetchYoutubeFormatUrl(videoId, itag, client, fetcher)

    if (url) return url
  }

  return null
}

const fetchDownloadRange = async (
  target: URL,
  headers: Headers,
  fetcher: Fetcher,
  signal: AbortSignal,
  start = 0,
  end = MEDIA_RANGE_CHUNK_BYTES - 1,
) => {
  const rangeHeaders = new Headers(headers)

  rangeHeaders.set("range", `bytes=${start}-${end}`)

  const headerTimeout = new AbortController()
  const timeoutId = setTimeout(() => headerTimeout.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    return await fetchAllowedTarget(
      target,
      {
        method: "GET",
        headers: rangeHeaders,
        signal: AbortSignal.any([signal, headerTimeout.signal]),
      },
      fetcher,
    )
  } catch (cause) {
    if (headerTimeout.signal.aborted) return null

    // eslint-disable-next-line no-console -- Workers Logs capture upstream failures.
    console.error("media proxy download request failed", cause)

    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Stream a complete media file as bounded ranges. googlevideo rejects a full
 * GET (and an open-ended range) with 403 for these URLs, while a bounded range
 * is served. The first bounded range is already open when this stream starts.
 */
const rangedMediaBody = (
  url: string,
  headers: Headers,
  fetcher: Fetcher,
  total: number,
  initialReader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
) => {
  let finished = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = initialReader
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let offset = 0
  let received = 0

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  const fail = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    message: string,
    name = "NetworkError",
  ) => {
    if (finished) return

    finished = true
    clearIdleTimer()
    const current = reader

    reader = null
    void current?.cancel().catch(() => undefined)
    controller.error(new DOMException(message, name))
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return

      try {
        while (!finished) {
          if (offset >= total) {
            finished = true
            clearIdleTimer()
            controller.close()

            return
          }

          if (!reader) {
            const end = Math.min(offset + MEDIA_RANGE_CHUNK_BYTES - 1, total - 1)
            const upstream = await fetchDownloadRange(
              new URL(url),
              headers,
              fetcher,
              signal,
              offset,
              end,
            )

            if (!upstream) {
              fail(controller, "The platform redirect was blocked.")

              return
            }

            if (upstream.status !== 206) {
              await upstream.body?.cancel()
              fail(controller, `The platform returned ${upstream.status} for this media.`)

              return
            }

            reader = upstream.body?.getReader() ?? null

            if (!reader) {
              fail(controller, "The platform did not return a media stream.")

              return
            }
          }

          const current = reader

          idleTimer = setTimeout(() => {
            if (finished) return

            finished = true
            clearIdleTimer()
            void current?.cancel().catch(() => undefined)
            controller.error(
              new DOMException("The upstream media stopped responding.", "TimeoutError"),
            )
          }, UPSTREAM_BODY_IDLE_TIMEOUT_MS)

          const chunk = await current.read()

          clearIdleTimer()

          if (finished) return

          if (chunk.done) {
            reader = null

            continue
          }

          received += chunk.value.byteLength

          if (received > total) {
            fail(controller, "The upstream media exceeded its declared size.")

            return
          }

          offset += chunk.value.byteLength
          controller.enqueue(chunk.value)

          return
        }
      } catch (cause) {
        fail(controller, cause instanceof Error ? cause.message : "The media download failed.")
      }
    },
    cancel(reason) {
      finished = true
      clearIdleTimer()
      const current = reader

      reader = null
      void current?.cancel(reason).catch(() => undefined)
    },
  })
}

const proxyDownload = async (
  request: Request,
  target: URL,
  fetcher: Fetcher,
  platform: SocialMediaPlatform | undefined,
  fileName: string | undefined,
  suppliedHeaders: Headers | undefined,
  videoId: string | undefined,
  itag: number | undefined,
) => {
  const headers = requestHeaders(suppliedHeaders ?? new Headers(), platform)
  let currentTarget = target
  let upstream = await fetchDownloadRange(currentTarget, headers, fetcher, request.signal)

  if (!upstream) return response("The platform request could not be completed.", 502)

  if ((upstream.status === 403 || upstream.status === 404) && videoId && itag !== undefined) {
    await upstream.body?.cancel()

    // Each player request mints a URL for this request's egress IP. If the
    // first retry still gets a different IP, try one more time.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const freshUrl = await resolveFreshYoutubeUrl(videoId, itag, fetcher)
      const freshTarget = freshUrl ? parseUpstreamUrl(freshUrl) : null

      if (!freshTarget) break

      currentTarget = freshTarget
      upstream = await fetchDownloadRange(currentTarget, headers, fetcher, request.signal)

      if (!upstream || upstream.ok) break

      await upstream.body?.cancel()
    }
  }

  if (!upstream) return response("The platform request could not be completed.", 502)

  if (!upstream.ok) {
    await upstream.body?.cancel()

    return response(
      upstream.status === 403 || upstream.status === 404
        ? "The platform denied this media download."
        : "The platform could not provide this media right now.",
      upstream.status === 403 || upstream.status === 404 ? upstream.status : 502,
    )
  }

  const finalUrl = upstream.url || currentTarget.toString()
  const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  const safeContentType =
    contentType?.startsWith("video/") ||
    contentType?.startsWith("audio/") ||
    contentType === "application/octet-stream" ||
    contentType === "binary/octet-stream"
      ? contentType
      : "application/octet-stream"
  const responseHeaders = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Disposition": contentDisposition(safeFileName(fileName ?? "video.mp4")),
    "Content-Type": safeContentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Yohaku-Final-Url": finalUrl,
  })

  if (upstream.status === 200) {
    const totalBytes = Number(upstream.headers.get("content-length") ?? 0)

    if (totalBytes > MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES) {
      await upstream.body?.cancel()

      return response("This video is larger than the supported download limit.", 413)
    }

    if (totalBytes > 0) responseHeaders.set("content-length", String(totalBytes))

    return new Response(bodyWithLimit(upstream.body, MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES), {
      status: 200,
      headers: responseHeaders,
    })
  }

  if (upstream.status !== 206) {
    await upstream.body?.cancel()

    return response("The platform did not return a media stream.", 502)
  }

  const total = parseContentRangeTotal(upstream.headers.get("content-range"))

  if (total === null) {
    await upstream.body?.cancel()

    return response("The platform did not return a complete media stream.", 502)
  }

  if (total > MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES) {
    await upstream.body?.cancel()

    return response("This video is larger than the supported download limit.", 413)
  }

  const initialReader = upstream.body?.getReader() ?? null

  if (!initialReader) return response("The platform did not return a media stream.", 502)

  responseHeaders.set("content-length", String(total))

  return new Response(
    rangedMediaBody(finalUrl, headers, fetcher, total, initialReader, request.signal),
    { status: 200, headers: responseHeaders },
  )
}

const proxy = async (
  request: Request,
  target: URL,
  kind: ProxyKind,
  fetcher: Fetcher,
  platform?: SocialMediaPlatform,
  fileName?: string,
  suppliedHeaders?: Headers,
  videoId?: string,
  itag?: number,
) => {
  if (kind === "download") {
    return proxyDownload(
      request,
      target,
      fetcher,
      platform,
      fileName,
      suppliedHeaders,
      videoId,
      itag,
    )
  }

  const requestContentLength = Number(request.headers.get("content-length") ?? 0)

  if (requestContentLength > MAX_SOCIAL_MEDIA_CONTROL_REQUEST_BYTES) {
    return response("The platform request was too large.", 413)
  }

  if (requestContentLength > 0 && request.method !== "POST") {
    return response("The platform request is invalid.", 400)
  }

  const upstreamMethod = request.method
  const body =
    upstreamMethod === "POST"
      ? await readRequestBody(request, MAX_SOCIAL_MEDIA_CONTROL_REQUEST_BYTES)
      : undefined

  if (body === null) return response("The platform request was too large.", 413)
  const headers = requestHeaders(request.headers, platform ?? inferPlatform(target))
  let upstream: Response | null
  const headerTimeout = new AbortController()
  const timeoutId = setTimeout(() => headerTimeout.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    upstream = await fetchAllowedTarget(
      target,
      {
        method: upstreamMethod,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: AbortSignal.any([request.signal, headerTimeout.signal]),
      },
      fetcher,
    )
  } catch (cause) {
    if (headerTimeout.signal.aborted) {
      return response("The platform request timed out. Try again.", 504)
    }

    // eslint-disable-next-line no-console -- Workers Logs capture upstream failures.
    console.error("media proxy upstream request failed", cause)

    return response("The platform request could not be completed.", 502)
  } finally {
    // Only the response headers are bounded; the body may stream for longer.
    clearTimeout(timeoutId)
  }

  if (!upstream) return response("The platform redirect was blocked or exceeded the limit.", 502)

  const limit = MAX_SOCIAL_MEDIA_CONTROL_BYTES
  const declaredLength = Number(upstream.headers.get("content-length") ?? 0)
  const contentRange = upstream.headers.get("content-range")
  const totalFromRange = contentRange?.match(/\/(\d+)$/)?.[1]
  const totalBytes = Number(totalFromRange ?? declaredLength)

  if (totalBytes > limit) {
    await upstream.body?.cancel()

    return response("The platform response was larger than the supported limit.", 413)
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Yohaku-Final-Url": upstream.url || target.toString(),
  })

  const etag = upstream.headers.get("etag")

  if (etag) responseHeaders.set("etag", etag)

  // The resolver reads bytes and never inspects the type. Serving upstream
  // HTML under this origin would render third-party scripts here.
  responseHeaders.set("Content-Type", "text/plain; charset=utf-8")
  responseHeaders.set("Content-Disposition", "attachment")
  responseHeaders.set("Content-Security-Policy", "sandbox")

  return new Response(bodyWithLimit(upstream.body, limit), {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const handleMediaResolveProxy = async (request: Request, fetcher: Fetcher = fetch) => {
  if (!isSameOriginRequest(request))
    return response("This proxy only accepts same-origin requests.", 403)

  if (request.method !== "GET" && request.method !== "POST") {
    return response("This request method is not supported.", 405)
  }

  const target = parseUpstreamUrl(new URL(request.url).searchParams.get("url"))

  if (!target || !isPlatformUrl(target.toString())) {
    return response("Only public YouTube, Instagram, and Facebook URLs are supported.", 400)
  }

  return proxy(request, target, "control", fetcher)
}

export const handleMediaDownloadProxy = async (request: Request, fetcher: Fetcher = fetch) => {
  if (!isSameOriginRequest(request))
    return response("This proxy only accepts same-origin requests.", 403)
  if (request.method !== "POST") return response("This request method is not supported.", 405)

  const download = await readDownloadRequest(request)

  if (!download) return response("The download request is invalid.", 400)

  const target = parseUpstreamUrl(download.url)

  if (!target || !isAllowedHost(target.hostname.toLowerCase())) {
    return response("The selected media URL is not supported.", 400)
  }

  const formatHeaders = new Headers()

  try {
    for (const { name, value } of download.headers) {
      if (SAFE_UPSTREAM_HEADERS.has(name.toLowerCase())) formatHeaders.set(name, value)
    }
  } catch {
    return response("The download request contains an invalid header.", 400)
  }

  return proxy(
    request,
    target,
    "download",
    fetcher,
    download.platform,
    download.fileName,
    formatHeaders,
    download.videoId,
    download.itag,
  )
}
