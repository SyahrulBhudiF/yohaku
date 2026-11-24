import { Option, Schema } from "effect"

import {
  MAX_SOCIAL_MEDIA_CONTROL_BYTES,
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
const MAX_CONTROL_REQUEST_BYTES = 1024 * 1024

type Fetcher = (url: string, init: RequestInit) => Promise<Response>
type ProxyKind = "control" | "download"

const response = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })

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

const isSameOrigin = (request: Request) => {
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

const inferPlatform = (target: URL): SocialMediaPlatform =>
  target.hostname.toLowerCase().includes("instagram") ||
  target.hostname.toLowerCase().includes("cdninstagram") ||
  target.hostname.toLowerCase().includes("fbcdn") ||
  target.hostname.toLowerCase().includes("fbsbx")
    ? "instagram"
    : "youtube"

const platformOrigin = (platform: SocialMediaPlatform) =>
  platform === "youtube" ? "https://www.youtube.com" : "https://www.instagram.com"

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

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = await reader.read()

      if (chunk.done) {
        controller.close()

        return
      }

      receivedBytes += chunk.value.byteLength

      if (receivedBytes > maxBytes) {
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
    },
    cancel(reason) {
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

  while (true) {
    const { value, done } = await reader.read()

    if (done) break

    received += value.byteLength

    if (received > maxBytes) {
      await reader.cancel()

      return null
    }

    chunks.push(value)
  }

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

  if (contentLength > MAX_CONTROL_REQUEST_BYTES) return null

  try {
    const bytes = await readRequestBody(request, MAX_CONTROL_REQUEST_BYTES)

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

const proxy = async (
  request: Request,
  target: URL,
  kind: ProxyKind,
  fetcher: Fetcher,
  platform?: SocialMediaPlatform,
  fileName?: string,
  suppliedHeaders?: Headers,
) => {
  const requestContentLength = Number(request.headers.get("content-length") ?? 0)

  if (kind === "control" && requestContentLength > MAX_CONTROL_REQUEST_BYTES) {
    return response("The platform request was too large.", 413)
  }

  if (kind === "control" && requestContentLength > 0 && request.method !== "POST") {
    return response("The platform request is invalid.", 400)
  }

  const upstreamMethod = kind === "control" ? request.method : "GET"
  const body =
    kind === "control" && upstreamMethod === "POST"
      ? await readRequestBody(request, MAX_CONTROL_REQUEST_BYTES)
      : undefined

  if (body === null) return response("The platform request was too large.", 413)
  const headers = requestHeaders(
    kind === "control" ? request.headers : (suppliedHeaders ?? new Headers()),
    platform ?? (kind === "control" ? inferPlatform(target) : undefined),
  )
  let upstream: Response | null

  try {
    upstream = await fetchAllowedTarget(
      target,
      {
        method: upstreamMethod,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: request.signal,
      },
      fetcher,
    )
  } catch {
    return response("The platform request could not be completed.", 502)
  }

  if (!upstream) return response("The platform redirect was blocked or exceeded the limit.", 502)

  const limit =
    kind === "control" ? MAX_SOCIAL_MEDIA_CONTROL_BYTES : MAX_SOCIAL_MEDIA_DOWNLOAD_BYTES
  const declaredLength = Number(upstream.headers.get("content-length") ?? 0)
  const contentRange = upstream.headers.get("content-range")
  const totalFromRange = contentRange?.match(/\/(\d+)$/)?.[1]
  const totalBytes = Number(totalFromRange ?? declaredLength)

  if (totalBytes > limit) {
    await upstream.body?.cancel()

    return response("This video is larger than the supported download limit.", 413)
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Yohaku-Final-Url": upstream.url || target.toString(),
  })

  for (const name of ["content-type", "etag"] as const) {
    const value = upstream.headers.get(name)

    if (value) responseHeaders.set(name, value)
  }

  if (kind === "download") {
    for (const name of ["accept-ranges", "content-length", "content-range"] as const) {
      const value = upstream.headers.get(name)

      if (value) responseHeaders.set(name, value)
    }

    responseHeaders.set(
      "Content-Disposition",
      contentDisposition(safeFileName(fileName ?? "video.mp4")),
    )
  }

  return new Response(bodyWithLimit(upstream.body, limit), {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const handleMediaResolveProxy = async (request: Request, fetcher: Fetcher = fetch) => {
  if (!isSameOrigin(request)) return response("This proxy only accepts same-origin requests.", 403)

  if (request.method !== "GET" && request.method !== "POST") {
    return response("This request method is not supported.", 405)
  }

  const target = parseUpstreamUrl(new URL(request.url).searchParams.get("url"))

  if (!target || !isPlatformUrl(target.toString())) {
    return response("Only public YouTube and Instagram URLs are supported.", 400)
  }

  return proxy(request, target, "control", fetcher)
}

export const handleMediaDownloadProxy = async (request: Request, fetcher: Fetcher = fetch) => {
  if (!isSameOrigin(request)) return response("This proxy only accepts same-origin requests.", 403)
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
  )
}
