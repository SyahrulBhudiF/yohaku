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

## Processing checks

Image tools run in the browser, so the tests exercise the codecs in Node (see
`tests/support/image-codecs.ts`) and the browser check below proves the real
path. For a tool that has a server step, test its handler through
`tests/apis/*.test.ts` and keep the same browser pass.

## UI changes

Run the app, open the affected route with `agent-browser`, and exercise the
states you changed: empty, file selected, processing, success, and error. Upload
a real image (not a fabricated buffer) and confirm the downloaded file's magic
bytes and byte count, not only the on-screen summary. Use
`agent-browser set viewport 1280 720 2` and save captures under an absolute path
in `.amp/in/artifacts/`. Check light and dark mode.
