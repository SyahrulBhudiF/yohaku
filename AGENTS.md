# Tools — Agent Rules

A centralized web app of file tools (image convert and compress today; PDF and
document tools later). One TanStack Start app: frontend and backend together.
Backend work runs in Effect v4. UI is shadcn on Base UI, styled after Material
Design 3.

Read [.agents/CONTEXT.md](.agents/CONTEXT.md) for architecture decisions. Use the
matching workflow in `.agents/skills/` when building server features, web
features, or verifying changes.

## Effect source

The Effect source is vendored at `repos/effect` (git subtree of
`Effect-TS/effect`, `main`). When unsure about an Effect v4 API, read it there
instead of guessing: `repos/effect/LLMS.md`, `repos/effect/ai-docs/`, and the
package sources under `repos/effect/packages/`. Refresh it with
`pnpm repos:sync`. Never edit files under `repos/`.

## Commands

- `pnpm dev` — dev server (port 3000)
- `pnpm build` — production build (Nitro, `.output/server/index.mjs`)
- `pnpm start` — run the production build
- `pnpm check` — format check + lint + typecheck
- `pnpm test:run` — run tests once (vitest)
- `pnpm lint:fix` / `pnpm format` — auto-fix lint / format
- Single test: `pnpm test:run tests/apis/image.test.ts`
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
src/apis/                 Request handlers (multipart parse, validate, runEffect, map errors)
src/routes/               TanStack file routes (thin); src/routes/api/** are server routes
src/features/<feature>/   Feature modules: components/, api.ts (client), store.ts (Zustand)
src/components/ui/        shadcn primitives on Base UI, M3-themed
src/infrastructure/       Effect services, errors, runtime, config
src/libs/schemas/         Effect Schemas shared by client and server (the contract)
src/libs/utils/           Client and shared helpers
src/libs/stores/          Cross-feature Zustand stores
src/styles.css            M3 tokens (--md-*) mapped onto shadcn tokens
tests/                    Mirrors src/ paths
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
- Run effects through `runEffect()` from `src/infrastructure/runtime`.
- Pure rules stay plain functions; use Effect for dependencies, async work, and
  typed failures.

## Error Handling

- Define domain errors in `src/infrastructure/errors/` with `Schema.TaggedError`.
- Never throw generic `Error` in services. Catch with `Effect.catch` /
  `Effect.catchTag`.
- Map tagged errors to HTTP statuses once, in `src/apis/`.
- UI: show errors inline next to the action; never lose the user's selected file.

## API routes

- Server routes in `src/routes/api/**` only call a handler from `src/apis/`.
- Handlers parse multipart input, validate with Effect Schema from
  `src/libs/schemas/`, run through `runEffect()`, and return a binary `Response`
  (with `Content-Disposition`, `X-Original-Bytes`, `X-Result-Bytes`) or a JSON
  `ApiErrorSchema` body.
- Files are processed in memory and never stored.

## UI

- shadcn components on Base UI live in `src/components/ui/`. Add more with
  `pnpm dlx shadcn@latest add <name>`, then replace the `cn` import with
  `@/libs/utils/cn` and restyle to M3 (pill buttons, 12/28px radii, state layers).
- Colors come from `--md-*` tokens in `src/styles.css`. Never hard-code a palette.
- State management is Zustand, one store per feature (`store.ts`).
- Route components stay thin and delegate to `src/features/`.
- Each new tool is added to `src/features/tools/registry.ts`.

## Validation

- Effect Schema defines the FE/BE contract in `src/libs/schemas/`. Parse at the
  handler boundary on the server and before sending on the client.

## Testing

- Vitest, node environment. Use `@effect/vitest` (`it.effect`) for Effect code.
- Test through public behavior (services, handlers), not internals.

## Git

- Husky pre-commit runs the check and test gates. Do not skip hooks.
