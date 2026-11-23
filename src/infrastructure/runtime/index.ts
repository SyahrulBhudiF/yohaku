import { Effect, type Layer, ManagedRuntime } from "effect"

import { AllServicesLive } from "@/infrastructure/services"

const runtime = ManagedRuntime.make(AllServicesLive)

export const runEffect = <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof AllServicesLive>>,
) => runtime.runPromise(effect)
