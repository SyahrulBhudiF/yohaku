import type { WebsiteEnv } from "../alchemy.run"

let pending: Promise<WebsiteEnv | undefined> | undefined

/**
 * The Worker bindings, typed by the Alchemy stack. `cloudflare:workers` only
 * resolves inside workerd, so plain Node dev gets `undefined` and runs without
 * the edge features.
 */
export const getEnv = (): Promise<WebsiteEnv | undefined> =>
  (pending ??= import(/* @vite-ignore */ "cloudflare:workers")
    .then((module) => module.env as WebsiteEnv)
    .catch(() => undefined))
