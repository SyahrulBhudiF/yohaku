import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Effect from "effect/Effect"

/**
 * The TanStack Start app on Cloudflare Workers. `Cloudflare.Website.Vite`
 * runs `vite build` with the Cloudflare Vite plugin and uploads the client
 * assets plus the SSR server bundle, so there is no Wrangler config.
 */
export class Website extends Cloudflare.Website.Vite<Website>()("Website", {
  // Pinning the zone lets the token skip Zone: Read; Alchemy attaches the
  // custom domain and its DNS record through the zone ID.
  domain: { name: "tools.ryuko.my.id", zoneId: "ee39ebd47c23ba4c6d4d49e21f7dde1a" },
}) {}

export default Alchemy.Stack(
  "Tools",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const website = yield* Website

    return { websiteUrl: website.url.as<string>() }
  }),
)
