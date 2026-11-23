# Project context

Read this with the root `AGENTS.md` before making architectural changes.

## What

Yohaku is a single TanStack Start app that hosts small file utilities. Image
convert and compress, and PDF merge and split, ship today. PDF to images, images
to PDF, PDF compression, and Word/Excel conversion are not built yet.

## Architecture decisions

1. **Keep routes thin.** Route files render feature modules from
   `src/features/`. Page behavior belongs in the feature.
2. **One tool, one slice.** A tool has a page route in `src/routes/<tool>/`,
   schemas in `src/libs/schemas/`, a feature folder, and a registry entry. A tool
   that needs a server adds a `createServerFn` in `src/apis/<tool>.ts` with its
   Effect handler in `<tool>.server.ts`.
3. **Use Effect where it earns its keep.** Processing sits behind
   `Context.Service` classes (`ImageProcessor`, `PdfProcessor`). Typed failures
   are `Schema.TaggedError`s mapped once at the boundary that presents them.
4. **Schemas define the contract.** Request options, error bodies, limits, and
   format maps live in `src/libs/schemas/` and are used by both client and server.
5. **Nothing is stored.** Uploads are read into memory, processed, and turned
   into a download URL. Enforce `MAX_IMAGE_BYTES` and the PDF limits in
   `src/libs/schemas/pdf.ts`.
6. **Process in the browser.** Cloudflare Workers Free allows 10 ms of CPU per
   request, so no native or WASM encoder can run on the server. Image work uses
   `@jsquash` codecs in the browser behind `ImageProcessor`; PDF merge/split uses
   `@mssio/qpdf-wasm` behind `PdfProcessor`, and pdf.js renders thumbnails. The
   Worker only serves the app. This keeps the app free, fast, and private.
7. **Shared UI boundary.** Primitives under `src/components/ui/` wrap Base UI and
   follow Material Design 3. Feature UI lives under `src/features/`.
8. **Query, Form, Zustand.** TanStack Query runs mutations, TanStack Form owns
   options, Zustand holds the selected file and result.
   Revoke object URLs when a file is replaced or removed.
9. **Six image formats.** PNG, JPEG, WebP and AVIF use `@jsquash`; GIF uses
   `gifenc`/`gifuct-js`; animated WebP uses `wasm-webp`; TIFF uses `utif`.
   Animated GIFs and WebPs keep their frames when converting to GIF or WebP;
   still formats use the first frame. PNG and TIFF are lossless.
10. **Tooling is TS Go.** `@effect/tsgo` provides the Effect diagnostics and an
    oxlint preset. Do not add ESLint or typescript-eslint.
11. **Cloudflare is deployed with Alchemy.** `alchemy.run.ts` declares
    `Cloudflare.Website.Vite`, which runs the Vite build with Alchemy's
    Cloudflare plugin and deploys the Worker plus static assets. No Wrangler
    config and no `@cloudflare/vite-plugin`.
12. **Static work stays under the free CPU budget.** Server rendering of a page
    costs a few milliseconds; keep server work small and keep encoders in the
    browser.
13. **Data-oriented hot paths.** Pixels and bytes are flat typed arrays, hot
    loops avoid per-pixel allocations, and a buffer is copied once at the
    boundary that needs it. `pnpm bench` measures the codecs; AVIF encodes at
    `speed: 9` (default 6 is ~9x slower), WebP at `method: 2` (default 4 is
    ~2x slower), and JPEG with `progressive: false` (~2x faster, ~1% larger).
14. **Tagged errors only.** No plain `Error` in `src/`; codec and PDF
    exceptions are mapped to tagged errors at the `Effect.tryPromise` boundary.
15. **PDF pages are a sortable grid.** dnd-kit reorders page thumbnails; qpdf
    receives page runs in that order. qpdf detaches a raw `Uint8Array` it is
    given, so pass `File`/`Blob` inputs. Merge uses `--empty --pages` and split
    uses qpdf's page selection; bookmarks and forms are not preserved.
