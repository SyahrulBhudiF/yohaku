import init, { MediaResolver } from "@/libs/wasm/social-media-core/social_media_core.js"

interface ResolverRequest {
  readonly id: number
  readonly url: string
}

type ResolverResponse =
  | { readonly id: number; readonly type: "result"; readonly info: unknown }
  | { readonly id: number; readonly type: "error"; readonly message: string }

const scope = self as unknown as {
  location: Location
  onmessage: ((event: MessageEvent<ResolverRequest>) => void) | null
  postMessage: (message: ResolverResponse) => void
}

let resolverPromise: Promise<InstanceType<typeof MediaResolver>> | null = null

const loadResolver = async () => {
  if (resolverPromise) return resolverPromise

  resolverPromise = (async () => {
    await init()

    const bridge = async (upstreamUrl: string, init: RequestInit) => {
      const proxyUrl = new URL("/api/media/resolve-proxy", scope.location.origin)

      proxyUrl.searchParams.set("url", upstreamUrl)

      return fetch(proxyUrl, { ...init, credentials: "same-origin" })
    }

    return new MediaResolver(bridge)
  })()

  resolverPromise.catch(() => {
    resolverPromise = null
  })

  return resolverPromise
}

scope.onmessage = async ({ data }) => {
  try {
    const resolver = await loadResolver()
    const info = await resolver.resolve(data.url)

    scope.postMessage({ id: data.id, type: "result", info })
  } catch (cause) {
    scope.postMessage({
      id: data.id,
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}
