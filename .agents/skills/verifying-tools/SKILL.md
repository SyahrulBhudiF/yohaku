---
name: verifying-tools
description: Runs the Tools format, lint, typecheck, test, build, API, and UI checks needed before reporting a change complete. Use after implementing or refactoring application behavior.
---

# Verifying Tools

Run checks against the real repository and report failures without hiding them.

## Static checks

```sh
pnpm check
pnpm test:run
pnpm build
```

If oxlint aborts with SIGABRT, run `sudo sysctl vm.overcommit_memory=1` and retry.
Treat diagnostics as evidence to read, not a reason to suppress a rule.

## API checks

Server functions have no stable public URL. Test handlers through
`tests/apis/*.test.ts` (call the `.server.ts` handler with a `FormData`), then
exercise the real flow in the browser (below): upload, submit, and one invalid
file for the error path.

## UI changes

Run the app, open the affected route with `agent-browser`, and exercise the
states you changed: empty, file selected, processing, success, and error. Use
`agent-browser set viewport 1280 720 2` and save captures under an absolute path
in `.amp/in/artifacts/`. If you cannot view an image, verify through the
accessibility snapshot and computed styles. Check light and dark mode.
