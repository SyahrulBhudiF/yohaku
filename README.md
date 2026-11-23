# Tools

Centralized file tools in one web app. Today: convert images between formats and
compress images. Planned: PDF merge/split, Word↔PDF, Excel→PDF.

**Stack:** TanStack Start on Cloudflare Workers, Effect v4, shadcn + Base UI
(Material Design 3), Zustand, Effect Schema contract, TS Go (`@effect/tsgo`),
Oxlint + Oxfmt, Alchemy for infrastructure.

```sh
pnpm install
pnpm dev            # http://localhost:3000
pnpm check          # format + lint + typecheck
pnpm test:run
pnpm build
pnpm run deploy     # alchemy deploy --stage prod
pnpm repos:sync     # clone Effect source into repos/effect (gitignored, for agents)
```

Images are converted and compressed in the browser with WebAssembly codecs
(`@jsquash`), so files never leave the device and the app fits the Cloudflare
Workers free plan (10 ms of CPU per request).

## Deploy

Alchemy deploys the app from `alchemy.run.ts`. Connect Cloudflare once:

```sh
pnpm exec alchemy profile edit --add Cloudflare
```

or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Then `pnpm run deploy`
publishes the Worker at `https://tools.ryuko.my.id` (Alchemy attaches the custom
domain and its certificate; the zone must live in the same Cloudflare account).
`pnpm run destroy` removes the stack.

Token scopes: Account — Workers Scripts: Edit, Secrets Store: Edit, Account
Settings: Read. Zone (`ryuko.my.id`) — DNS: Edit, Workers Routes: Edit.

CI/CD: `.github/workflows/ci.yml` runs `pnpm check`, the tests and the build on
every pull request, and deploys `main` after the checks pass. Add
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets under
Settings → Secrets and variables → Actions; the token needs the scopes above.
You can also run the workflow from the Actions tab (`workflow_dispatch`).

See `AGENTS.md` for conventions and `.agents/CONTEXT.md` for decisions.
