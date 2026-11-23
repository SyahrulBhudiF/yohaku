# Git and commit history

- Write new commit subjects in Conventional Commits format: `type(scope): imperative summary`. Use `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, or `chore`; omit the scope when it adds no useful context. Keep the subject specific and under 72 characters.
- Add a commit body only when it explains a non-obvious reason or trade-off. Do not put implementation inventories in the subject.
- Examples: `feat(pdf): add page-range selection`, `perf(image): reuse decoded pixel buffers`, `docs: clarify local development setup`.
- Preserve the existing author identity when rewriting commits. Rewriting commits changes their IDs and invalidates signatures; never force-push rewritten published history without the user's explicit approval for that push.
- Before rewriting history, confirm the exact branch and remote range, preserve all changes, and show the proposed old-to-new subject mapping. Do not rewrite commits outside the requested range.
