---
name: building-web-features
description: Adds or changes Tools UI, meaning thin TanStack routes, feature-owned components and Zustand stores, and Material Design 3 styled shadcn/Base UI primitives. Use for work in src/routes, src/features, or src/components.
---

# Building web features

Read the root `AGENTS.md`, `.agents/CONTEXT.md`, and
`.agents/ARCHITECTURE.md` first. The architecture gate is
`pnpm arch:check`, and it is part of `pnpm check`.

## Layout

- `src/routes/` holds route definitions and renders a feature page only.
- Feature code lives in `src/features/<feature>/`: `components/`, `process.ts`
  (local work) or `api.ts` (server calls), `store.ts` (Zustand for client-only state).
- Use TanStack Query `useMutation`/`useQuery` for requests and async data, and
  TanStack Form for options, validated with `Schema.toStandardSchemaV1` of the
  shared Effect Schema.
- Do not `await` in a form submit or button handler. Use `mutation.mutate(...)`
  and read `mutation.error`; keep multi-step orchestration in a hook or process.
- Data fetching (thumbnails, page previews, remote metadata) belongs in
  `useQuery`, not `useEffect`.
- `useEffect` is only for external synchronization (observers, scroll/focus,
  theme, object-URL cleanup, unmount cleanup). Put the exact marker
  `// architecture: external synchronization` immediately above it.
- Shared primitives live in `src/components/ui/` (shadcn on Base UI).
- A new tool also needs an entry in `src/features/tools/registry.ts`.

## Interaction rules

- Style with the `--md-*` tokens in `src/styles.css`; follow Material Design 3:
  pill buttons, 12px/28px radii, tonal surfaces, state layers. No hard-coded colors.
- Use semantic controls and labels; keep keyboard and screen-reader access.
- Show actionable errors inline next to the control. Keep the selected file when
  a request fails.
- Show before/after sizes for results. Revoke object URLs on replace/remove.

## Workflow

1. Find the owning feature and reuse its components and store.
2. Keep local work in `process.ts` and server calls in `api.ts`; keep request
   status in Query, not the store.
3. Run `pnpm arch:check` before the normal verification.
4. For rendered changes, run the app and exercise each state as described in
   `.agents/skills/verifying-tools/SKILL.md`.
