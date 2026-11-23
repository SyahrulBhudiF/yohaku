# Project context

Read this with the root `AGENTS.md` before making architectural changes.

## What

Tools is a single TanStack Start app that hosts small file utilities. Image
convert and compress ship first. PDF and document tools (merge, split, word↔pdf,
excel→pdf) are planned and already listed as "coming soon" in the registry.

## Architecture decisions

1. **Keep routes thin.** Route files render feature modules from
   `src/features/`. Page behavior belongs in the feature.
2. **One tool, one slice.** A tool is a handler in `src/apis/`, a server route in
   `src/routes/api/<tool>/`, a page route in `src/routes/<tool>/`, schemas in
   `src/libs/schemas/`, a feature folder, and a registry entry.
3. **Use Effect where it earns its keep.** Processing sits behind
   `Context.Service` classes (`ImageProcessor`). Typed failures are
   `Schema.TaggedError`s mapped to HTTP statuses at the handler boundary.
4. **Schemas define the contract.** Request options, error bodies, limits, and
   format maps live in `src/libs/schemas/` and are used by both client and server.
5. **Nothing is stored.** Uploads are processed in memory and streamed back.
   Enforce `MAX_IMAGE_BYTES`; add per-tool limits for new tools.
6. **Binary in, binary out.** Handlers accept multipart form data and return the
   file with size headers, so the client can show before/after sizes.
7. **Shared UI boundary.** Primitives under `src/components/ui/` wrap Base UI and
   follow Material Design 3. Feature UI lives under `src/features/`.
8. **Zustand per feature.** Stores hold selected file, options, status, and result.
   Revoke object URLs when a file is replaced or removed.
9. **Native dependencies.** Image work uses `sharp`. Future PDF/Office tools may
   need extra system binaries (for example LibreOffice); document them in
   `.agents/setup` when added.
10. **Tooling is TS Go.** `@effect/tsgo` provides the Effect diagnostics and an
    oxlint preset. Do not add ESLint or typescript-eslint.
