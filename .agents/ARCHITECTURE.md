# Architecture contract

This is the review gate for every change. Read it with the root `AGENTS.md`
before touching a feature. `pnpm arch:check` is part of `pnpm check`; a change
that violates the hard rules cannot pass the pre-commit gate.

## The only allowed flow

```text
src/routes/<tool>.tsx          thin route: createFileRoute + feature page only
        ↓
src/features/<feature>/        page component
        ↓
TanStack Form + TanStack Query  form state + request state
        ↓
process.ts / use-*.ts          local orchestration and typed failures
        ↓
Effect service or codec worker domain work, WASM, files, bytes
        ↓
src/libs/schemas/              shared Effect Schema contract
```

Zustand stores only client-owned state: selected files, previews, result
object URLs, and UI selection. It must not hold request status, form values, or
duplicate Query data.

## Hard rules

1. **Routes are thin.** A route imports `createFileRoute` and one feature page.
   No schemas, infrastructure, codecs, or feature internals in a route.
2. **Schemas are Effect Schema.** `src/libs/schemas/` contains `Schema.Struct`,
   `Schema.Literals`, and derived `type`s. Do not add `interface` contracts
   there. Parse at the form/server/process boundary.
3. **Process work is Effect.** Every `src/features/<feature>/process.ts` uses
   `runEffect`; dependencies, async work, and failures live in the Effect
   channel. Plain `new Error` is forbidden in `src/`; use `Schema.TaggedError`.
4. **Views do not own domain work.** Components must not import codecs,
   infrastructure services, `runEffect`, or `fetch`. Use TanStack Query
   mutations/queries and call the feature process.
5. **No raw async form handlers.** Use `mutation.mutate(...)` in
   `onSubmit`/button handlers. Keep `mutateAsync` and multi-step async
   orchestration in a hook or process. Browser pickers such as the File System
   Access picker live in a hook (`useSocialMediaDownloader`), not a view.
6. **`useEffect` is for external synchronization only.** Allowed uses are DOM
   observers, scroll/focus synchronization, theme/DOM integration, object-URL
   cleanup, and route unmount cleanup. Put the exact marker
   `// architecture: external synchronization` immediately above the effect.
   Never use an effect to fetch data; use TanStack Query.
7. **Query owns request state.** `isPending`, `error`, retries, and cached
   async data come from Query. Do not mirror them in Zustand or local state.
8. **Form owns options.** TanStack Form with
   `Schema.toStandardSchemaV1(sharedSchema)` owns editable options and
   validation. Do not hand-roll form state with `useState`.
9. **Server work is `createServerFn`.** Add `src/apis/<name>.ts` and
   `<name>.server.ts`; never add `src/routes/api/**`. Streaming proxy handlers
   are the documented exception because a server function cannot stream a
   long-lived media response.
10. **Data-oriented hot paths.** Keep bytes/pixels in flat typed arrays, avoid
    per-pixel objects, copy once at a library boundary, and keep heavy codecs
    in workers. Read the image/PDF/document sections of `AGENTS.md` before
    changing a codec path.

## Media proxy boundary

`src/apis/social-media-proxy.server.ts` is the one allowed streaming exception to
the server-function rule. Its security contract is:

- Same-origin requests only, checked again in the handler and before the rate
  limit in `src/start.ts`.
- Upstream URLs must use HTTPS, carry no credentials, and match the platform
  host allowlist. Every redirect is revalidated against the same rules.
- Forward only the documented upstream header allowlist; never forward cookies,
  authorization, forwarding headers, or other browser credentials.
- Control responses are inert `text/plain` attachments with a sandbox CSP.
  Download responses always use `Content-Disposition: attachment`; non-media
  content types are forced to `application/octet-stream`.
- Enforce request and response size caps, a request-body timeout, an upstream
  header timeout, and an upstream body idle timeout. Never buffer an unbounded
  response.
- Do not store media. Stream it to the client or the user-selected file handle.

Any change to this file needs tests in `tests/apis/social-media-proxy.test.ts`
covering the changed boundary.

## Verification

```sh
pnpm arch:check   # hard architecture gate, also part of pnpm check
pnpm check        # format + lint + typecheck + architecture
pnpm test:run
pnpm build
```

For UI changes also follow
`.agents/skills/verifying-tools/SKILL.md`: run the route in a browser, exercise
empty/selected/pending/success/error states, and inspect the capture.

## When adding a tool

1. Add the shared schemas and limits in `src/libs/schemas/`.
2. Add tagged errors in `src/infrastructure/errors/`.
3. Put the Effect program in `src/features/<tool>/process.ts`; expose it with
   `runEffect`.
4. Add the Zustand store only for files/results/UI selection.
5. Build the page with TanStack Form + Query; keep the route thin.
6. Register the tool in `src/features/tools/registry.ts`.
7. Add tests under `tests/` and run the verification commands above.
