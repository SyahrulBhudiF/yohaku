---
name: architecture-review
description: Reviews and fixes Yohaku changes against the architecture contract: thin routes, TanStack Query/Form, Zustand boundaries, Effect processes, tagged errors, and the automated architecture gate. Use when auditing a feature or before reporting a refactor complete.
---

# Architecture review

Read `AGENTS.md`, `.agents/ARCHITECTURE.md`, and the owning feature before
editing.

## Review in this order

1. **Boundary** — Does the route only render a feature page? Does the component
   call a process/hook instead of a codec, service, `runEffect`, or `fetch`?
2. **State** — Are editable options in TanStack Form, request state in TanStack
   Query, and only files/results/UI selection in Zustand?
3. **Async** — Is `onSubmit` using `mutation.mutate` rather than
   `mutateAsync`? Is any remaining `await` a browser gesture or a hook-level
   orchestration?
4. **Effects** — Does every `useEffect` have
   `// architecture: external synchronization` and a genuine external-system
   reason? Replace data fetching with `useQuery`.
5. **Domain** — Does `process.ts` expose `runEffect`, use tagged errors, and
   keep plain `Error` out of `src/`?
6. **Contract** — Are schemas in `src/libs/schemas/` Effect Schema types, and
   is the boundary parsed?
7. **Hot path** — Are bytes/pixels flat typed arrays, workers bounded, and
   buffers copied only at the required boundary?

## Gate

```sh
pnpm arch:check
pnpm check
pnpm test:run
pnpm build
```

`pnpm arch:check` fails on hard violations and on unmarked effects, raw async
form handlers, or `mutateAsync` in components. Do not suppress a warning by
weakening the script; fix the boundary or add a narrow, documented exception to
`scripts/check-architecture.mjs` with a reason.
