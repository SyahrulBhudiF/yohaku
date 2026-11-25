# Yohaku — Agent Rules

Yohaku is a centralized web app of file tools (image, PDF, and Office
documents to PDF today; more tools later). One TanStack Start app deployed to Cloudflare
Workers. Image and document work runs in the browser in Effect v4; server work,
when a tool needs it, also runs in Effect v4. UI is shadcn on Base UI, styled
after Material Design 3.

Read [.agents/CONTEXT.md](.agents/CONTEXT.md) for architecture decisions and
[.agents/GIT.md](.agents/GIT.md) for commit conventions. Use the matching
workflow in `.agents/skills/` when building server features, web features, or
verifying changes.

## Effect source

The Effect source is cloned at `repos/effect` (shallow clone of
`Effect-TS/effect`, `main`; gitignored, not committed). When unsure about an Effect v4 API, read it there
instead of guessing: `repos/effect/LLMS.md`, `repos/effect/ai-docs/`, and the
package sources under `repos/effect/packages/`. Create or refresh it
with `pnpm repos:sync` (`.agents/setup` runs it). Never edit files under `repos/`.

## Commands

- `pnpm dev` — dev server (port 3000)
- `pnpm dev:cloudflare` — dev server inside workerd with Alchemy bindings
- `pnpm build` — production build (`dist/`)
- `pnpm run deploy` — `alchemy deploy` to Cloudflare Workers
- `pnpm run destroy` — remove the deployed stack
- `pnpm check` — format check + lint + typecheck
- `pnpm test:run` — run tests once (vitest)
- `pnpm bench` — run the image codec benchmarks
- `pnpm wasm:build` — rebuild the Rust/WASM packages
- `pnpm wasm:test` — run the Rust crate tests
- `pnpm lint:fix` / `pnpm format` — auto-fix lint / format
- Single test: `pnpm test:run tests/infrastructure/services/image-processor.test.ts`
- Pre-commit (husky): `pnpm check && pnpm test:run`

## Toolchain

- **Package manager**: pnpm 12 (`pnpm install`). No npm, yarn, or Bun commands.
- **TypeScript**: TS Go (TypeScript 7) with the Effect language service via
  `@effect/tsgo`. `pnpm typecheck` runs `effect-tsgo tsc`.
- **Linter**: oxlint (`.oxlintrc.json`), extending the `@effect/tsgo` preset.
- **Formatter**: oxfmt (`.oxfmtrc.json`, no semicolons).
- **Blank-line rule**: `@stylistic/eslint-plugin` runs inside oxlint as a JS
  plugin (`stylistic/padding-line-between-statements`): blank lines around
  block-like statements, after variable declarations, and before `return`. It
  does not run through ESLint, because typescript-eslint does not support TS 7.
- **Test**: vitest + `@effect/vitest` (`tests/**/*.test.ts`)
- If oxlint crashes with SIGABRT (JS plugin host needs virtual memory), run
  `sudo sysctl vm.overcommit_memory=1`. `.agents/setup` and `.agents/resume` do
  this already.

## Folder Contract

```
alchemy.run.ts            Cloudflare stack: the Website resource and stack outputs
src/routes/               TanStack file routes (thin, pages only)
src/features/<feature>/   Feature modules: components/, process.ts or api.ts, store.ts (Zustand)
src/components/ui/        shadcn primitives on Base UI, M3-themed
src/apis/                 createServerFn wrappers (`<name>.ts`) + Effect handlers (`<name>.server.ts`), only for tools that need a server
src/infrastructure/       Effect services, errors, runtime, config
src/libs/schemas/         Effect Schemas shared by client and server (the contract)
src/libs/utils/           Client and shared helpers
src/libs/stores/          Cross-feature Zustand stores
src/styles.css            M3 tokens (--md-*) mapped onto shadcn tokens
tests/                    Mirrors src/ paths; tests/support/ holds shared fixtures
packages/                 Rust/WASM cores (generated packages go under src/libs/wasm/)
repos/                    Vendored upstream source (read-only)
```

## TypeScript

- Strict mode. Path alias `@/*` → `./src/*`.
- Use `import type` / inline `type` for type-only imports.

## Naming

- Components: `PascalCase`. Hooks and stores: `useXxx`.
- Handlers: `handleVerbNoun` (`handleConvertImage`). Schemas: `XxxSchema`.
- Non-component files: `kebab-case.ts`. Errors: `XxxError`.

## Effect-TS Pattern

Installed version is effect 4.1.5. Use `Context.Service` (not `ServiceMap`) and
`Schema.TaggedError` (not `TaggedErrorClass`, which this version lacks).

```ts
import { Context, Effect, Layer } from "effect"

export class MyService extends Context.Service<
  MyService,
  { readonly run: (input: string) => Effect.Effect<string, MyError> }
>()("MyService") {
  static readonly layer = Layer.succeed(this, { run: (input) => Effect.succeed(input) })
}
```

- Register layers in `src/infrastructure/services/index.ts`.
- Run effects through `runEffect()` from `src/infrastructure/runtime`, on the
  client and on the server.
- Pure rules stay plain functions; use Effect for dependencies, async work, and
  typed failures.

## Error Handling

- Define domain errors in `src/infrastructure/errors/` with `Schema.TaggedError`.
- Never construct or throw a plain `Error` in `src/`. Return tagged errors in
  the Effect failure channel (`yield* new XxxError(...)`); map library and codec
  exceptions once, at the `Effect.tryPromise` boundary.
- Map tagged errors once, at the boundary that turns them into a response (a
  server handler) or a message (a feature mutation).
- UI: show errors inline next to the action; never lose the user's selected file.

## Image processing

- Cloudflare Workers Free allows 10 ms of CPU per request, so no server-side
  encoder can run there. Images are decoded and encoded in the browser behind
  the `ImageProcessor` service: `@jsquash` WebAssembly for PNG, JPEG, WebP and
  AVIF, `gifenc`/`gifuct-js` for GIF, `wasm-webp` for animated WebP, and `utif`
  for TIFF.
- Supported formats are PNG, JPEG, WebP, AVIF, GIF and TIFF. Animated GIFs and
  WebPs keep their frames when the output is GIF or WebP; still outputs use the
  first frame. PNG and TIFF are lossless; quality drives JPEG, WebP, AVIF
  and the GIF palette size.
- Import codecs lazily (`await import("@jsquash/webp/encode")`) so each format
  loads only when used, and warm the selected encoder with
  `preloadImageCodec()` before the user submits. Keep `optimizeDeps.exclude`
  for the codec packages in `vite.config.ts`.
- Codec helpers live in `src/libs/utils/image-codec/` (detect, decode, encode,
  preload); `ImageProcessor` only orchestrates detect → decode → encode.
- Background removal is non-AI. The only matte is
  `packages/background-removal-core` (Rust/WASM): it samples the border colour,
  grows a border-connected mask, feathers it with a one-pixel box blur, and
  de-spills edge pixels. `background-removal-wasm.ts` loads the 26 KB module;
  `background-removal-solid.ts` only decodes the image and encodes the result.
  `background-removal-worker.ts` keeps the Rust path off the main thread. It
  targets uniform studio backgrounds; no model or JS matte fallback exists.
- Image to SVG is an output option in the existing image converter, not a
  separate tool. It uses `imagetracerjs` on a canvas-decoded image capped at
  `MAX_VECTOR_SIDE` (1024 px); presets are high, balanced, and line. The Rust
  `vtracer` path was evaluated but reverted because its photographic output was
  too posterized.
- Image to PDF uses `packages/image-pdf-core` (Rust/WASM): PNG is decoded and
  Flate-compressed, JPEG stays DCT-encoded, and page geometry is stored in a
  `soa-rs` `Soa<PageLayout>`. The browser path does not call pdf-lib; pdf-lib is
  only a test dependency for loading generated PDFs.
- All three paths cap input at `MAX_IMAGE_PIXELS` (24 MP) where applicable and
  process in memory; never upload the source image. Keep the Rust packages
  lazy-loaded.
- Files are processed in memory and never uploaded or stored.
- Node cannot fetch the codecs' `file://` wasm. Tests call
  `initImageCodecs()` from `tests/support/image-codecs.ts` before using the
  processor.

## PDF processing

- PDF merge and split run qpdf as WebAssembly in the browser behind
  `PdfProcessor`; pass `File`/`Blob` inputs because qpdf detaches raw byte views.
- PDF to image renders selected pages (empty means all; ranges like `1-3, 5`)
  with pdf.js at 72/150/300 DPI. PNG and JPEG use the browser's native canvas
  encoder; WebP/AVIF/GIF/TIFF encode through a bounded `ImageProcessor` worker
  pool with pipelined rendering.
- Image to PDF is assembled by `packages/image-pdf-core`. PNG is decoded and
  Flate-compressed; upright JPEG stays byte-for-byte DCT-encoded; rotated JPEGs
  and other formats are normalized first.
- Page numbers and text/logo watermarks are added with pdf-lib in a module
  worker; page ranges reuse `parsePageSelection`. Encrypted PDFs are rejected
  and the UI says to unlock them first. Annotations rewrite the PDF, so existing
  digital signatures may be invalidated.
- dnd-kit orders PDF pages and image-to-PDF cards. OS file drops stay on native
  `drop` events because dnd-kit only tracks in-app drags.

## Document processing

- Excel→PDF lives in `packages/xlsx-pdf-core` (`calamine` + `pdf-writer`) and is
  called from the browser through the generated package in
  `src/libs/wasm/xlsx-pdf-core/`.
- Keep the core data-oriented: one UTF-8 text arena and flat `Span` records per
  sheet, flat `u16` widths, and a `soa-rs` `Soa<Column>` for width/x-offset.
  Avoid `Vec<Vec<String>>` and per-cell allocations in hot loops.
- `lib.rs` is the public API and WASM boundary only. Parsing, layout, rendering,
  limits, and errors live in their own modules.
- Rebuild with `pnpm wasm:build` and test with `pnpm wasm:test`; commit the
  generated package so the app build does not need Rust. CI runs the crate
  tests with a stable Rust toolchain.
- Excel→PDF is a table export: no formulas, charts, merged cells, or full
  Unicode. Standard Helvetica uses WinAnsi encoding.
- PowerPoint→PDF lives in `packages/pptx-pdf-core` and renders PPTX slides in
  a worker through `src/libs/wasm/pptx-pdf-core/`. It covers slide size and
  order, backgrounds, preset shapes, solid/gradient fills, images with crop and
  alpha, tables, and styled text. Charts, SmartArt, animations, and legacy
  `.ppt` files are rejected or skipped. Keep the parsed deck flat: shape,
  paragraph, and run records with one text arena.

## Data-oriented design

- Model image and byte data as flat typed arrays (`Uint8Array`,
  `Uint8ClampedArray`, `ImageData`), not objects per pixel.
- Keep hot loops over contiguous buffers and allocation-free; hoist lengths and
  copy a whole buffer with `set` when the shape allows it (a full-canvas GIF
  frame is one `set`, not a per-pixel walk).
- Pass buffers by reference and copy once at a boundary that requires it.
  Normalize `byteOffset`/`byteLength` before handing a view to a library that
  reads the backing buffer.
- Keep configuration as plain records and pure functions; services carry
  dependencies and typed failures only.

## Performance

- Measure before changing a hot path: `pnpm bench` runs `tests/**/*.bench.ts`.
- Keep server work inside the Workers free CPU budget; codecs and heavy loops
  stay in the browser.
- Codec settings are a contract: AVIF uses `speed: 9` (~9x faster than the
  default 6 for about 2% larger output), WebP uses `method: 2` (~2x faster than
  the default 4), and JPEG uses `progressive: false` (~2x faster for ~1% larger
  files). Record the tradeoff when changing one.

## Server functions

Only add a server step when the work fits Workers' CPU budget. Image tools do
not have one.

- The backend is `createServerFn` in `src/apis/<name>.ts`. No hand-written
  `src/routes/api/**` endpoints.
- Server fns validate that input is `FormData`, call a handler from
  `<name>.server.ts`, and `throw` the `Response` on non-2xx so the client sees an
  error. Success returns the binary `Response` (`Content-Disposition`,
  `X-Original-Bytes`, `X-Result-Bytes`).
- `.server.ts` handlers decode fields with Effect Schema from `src/libs/schemas/`,
  run through `runEffect()`, and map tagged errors to statuses (400/413/415/422)
  with a JSON `ApiErrorSchema` body. Keep Node-only imports out of `<name>.ts`.

## UI

- shadcn components on Base UI live in `src/components/ui/`. Add more with
  `pnpm dlx shadcn@latest add <name>`, then replace the `cn` import with
  `@/libs/utils/cn` and restyle to M3 (pill buttons, 12/28px radii, state layers).
- Colors come from `--md-*` tokens in `src/styles.css`. Never hard-code a palette.
- Async work uses TanStack Query (`useMutation`/`useQuery`) even when it runs
  locally; forms use TanStack Form with `Schema.toStandardSchemaV1(...)` from the
  shared Effect Schema.
- Zustand (`store.ts`, one per feature) holds client-only state such as the
  selected file and result object URLs, not request status or form values.
- Route components stay thin and delegate to `src/features/`.
- Each new tool is added to `src/features/tools/registry.ts`.

## Validation

- Effect Schema defines the contract in `src/libs/schemas/`. Parse at the
  boundary where data enters: a form submit, or a server handler.

## Deployment

- Infrastructure is Alchemy (`alchemy.run.ts`): `Cloudflare.Website.Vite` builds
  the app with Alchemy's Cloudflare Vite plugin and deploys the Worker plus
  static assets. Do not add a Wrangler config or `@cloudflare/vite-plugin`.
- Credentials come from an Alchemy profile (`alchemy profile edit --add
  Cloudflare`) or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
- The Worker serves `yohaku.ryuko.my.id`; Alchemy owns the DNS record and edge
  certificate, so the zone must be in the same Cloudflare account.
- `src/start.ts` holds global request middleware. Document requests are rate
  limited per IP with the `RATE_LIMIT` binding (60 per 60 s) declared in
  `alchemy.run.ts`; static assets bypass the Worker and are not counted.
- `pnpm run deploy` targets the `prod` stage; `pnpm run destroy` removes it.
- Pushes to `main` deploy through `.github/workflows/ci.yml` after the check job
  passes. It reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from
  repository secrets; keep the workflow's action versions current.

## Testing

- Vitest, node environment. Use `@effect/vitest` (`it.effect`) for Effect code.
- Test through public behavior (services, feature entry points), not internals.

## Git

- Husky pre-commit runs the check and test gates. Do not skip hooks.
