---
name: building-server-features
description: Adds or changes Tools backend features, meaning TanStack Start server routes, request handlers, and Effect v4 services, schemas, and tagged errors. Use for work in src/apis, src/routes/api, src/infrastructure, or src/libs/schemas.
---

# Building server features

Read the root `AGENTS.md` and `.agents/CONTEXT.md` first. For Effect v4 API
questions, read `repos/effect/LLMS.md` and `repos/effect/ai-docs/`.

## Boundaries

- Define request and response schemas with Effect Schema in `src/libs/schemas/`.
- Server routes in `src/routes/api/<tool>/` only call a handler in `src/apis/`.
- Handlers parse multipart input, validate, run an Effect through `runEffect()`,
  and map tagged errors to HTTP statuses (400, 413, 415, 422).
- Processing and other external effects live in `src/infrastructure/services/`
  as `Context.Service` classes with a `static layer`. Register the layer in
  `src/infrastructure/services/index.ts`.
- Domain failures are `Schema.TaggedError`s in `src/infrastructure/errors/`.
- Never store uploads. Enforce size limits before processing.

## Workflow

1. Read the closest implementation: `src/apis/image.ts` and
   `src/infrastructure/services/image-processor.ts`.
2. Add or update the schema, then the error, then the service, then the handler,
   then the route.
3. Add tests under `tests/` mirroring the source path. Use `@effect/vitest` for
   services and call handlers directly with a `Request` for APIs.
4. Run `.agents/skills/verifying-tools/SKILL.md`.
