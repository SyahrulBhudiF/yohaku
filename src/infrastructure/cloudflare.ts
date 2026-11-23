export interface RateLimitBinding {
  readonly limit: (options: { key: string }) => Promise<{ success: boolean }>
}

export interface WorkerEnv {
  readonly RATE_LIMIT?: RateLimitBinding
}

/**
 * The Worker's bindings. `cloudflare:workers` only resolves inside workerd, so
 * plain Node dev gets `undefined` and runs without the edge features.
 */
export const getWorkerEnv = async (): Promise<WorkerEnv | undefined> => {
  try {
    const cloudflare = await import("cloudflare:workers")

    return cloudflare.env as WorkerEnv
  } catch {
    return undefined
  }
}

export const getRateLimiter = async (): Promise<RateLimitBinding | undefined> =>
  (await getWorkerEnv())?.RATE_LIMIT
