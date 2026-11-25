---
name: building-server-features
description: Adds or changes Tools backend features, meaning TanStack Start server functions, Effect handlers, and Effect v4 services, schemas, and tagged errors. Use for work in src/apis, src/infrastructure, or src/libs/schemas.
---

# Building server features

Read the root `AGENTS.md`, `.agents/CONTEXT.md`, and
`.agents/ARCHITECTURE.md` first. For Effect v4 API questions, read
`repos/effect/LLMS.md` and `repos/effect/ai-docs/`.

## Boundaries

- Define request and response schemas with Effect Schema in `src/libs/schemas/`.
- Expose backend work as `createServerFn` in `src/apis/<tool>.ts`; it only validates
  `FormData`, calls the handler in `<tool>.server.ts`, and throws non-2xx `Response`s.
  Do not add `src/routes/api/**`; the streaming media proxy is the documented
  exception.
- Handlers decode fields, run an Effect through `runEffect()`, and map tagged
  errors to HTTP statuses (400, 413, 415, 422).
- Server-side work stays small enough for the Workers free plan (10 ms CPU per
  request); heavy work belongs in the browser.
- Processing and other external effects live in `src/infrastructure/services/`
  as `Context.Service` classes with a `static layer`. Register the layer in
  `src/infrastructure/services/index.ts`.
- Domain failures are `Schema.TaggedError`s in `src/infrastructure/errors/`.
- Never store uploads. Enforce size limits before processing.

## Workflow

1. Read `src/infrastructure/services/image-processor.ts` for the service shape and
   `src/features/image-tools/process.ts` for how a feature runs it. No image tool
   has a server step today: they run in the browser under the Workers CPU budget.
2. Add or update the schema, then the error, then the service, then the handler,
   then the server function.
3. Add tests under `tests/` mirroring the source path. Use `@effect/vitest` for
   services and call `.server.ts` handlers directly with a `FormData` for APIs.
4. Run `pnpm arch:check`, then `.agents/skills/verifying-tools/SKILL.md`.
