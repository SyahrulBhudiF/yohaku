# Tools

Centralized file tools in one web app. Today: convert images between formats and
compress images. Planned: PDF merge/split, Word↔PDF, Excel→PDF.

**Stack:** TanStack Start (frontend + backend), Effect v4, shadcn + Base UI
(Material Design 3), Zustand, Effect Schema contract, TS Go (`@effect/tsgo`),
Oxlint + Oxfmt.

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # format + lint + typecheck
pnpm test:run
pnpm build && pnpm start
pnpm repos:sync   # vendor Effect source into repos/effect (after first commit)
```

Files are processed in memory and never stored. See `AGENTS.md` for conventions.
