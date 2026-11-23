import { createMiddleware, createStart } from "@tanstack/react-start"

import { getEnv } from "@/env"

const WINDOW_SECONDS = 60

const clientKey = (request: Request) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown"

/**
 * Every document request counts against the client IP's edge limit. Static
 * assets never reach the Worker, so they are not counted.
 */
const rateLimit = createMiddleware().server(async ({ next, request }) => {
  const env = await getEnv()

  if (env !== undefined) {
    const { success } = await env.RATE_LIMIT.limit({ key: clientKey(request) })

    if (!success) {
      throw new Response("Too many requests. Try again in a minute.", {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": String(WINDOW_SECONDS),
        },
      })
    }
  }

  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [rateLimit],
}))
