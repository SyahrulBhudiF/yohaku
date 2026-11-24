# Project context

Read this with the root `AGENTS.md` before making architectural changes.

## What

Yohaku is a single TanStack Start app that hosts small file utilities. It
converts and compresses images, removes uniform backgrounds, traces images to
SVG, handles PDF pages and signatures, converts between PDF, images, Word, and
Excel, extracts audio from local media files to MP3, and downloads public
YouTube or Instagram videos.

## Architecture decisions

1. **Keep routes thin.** Route files render feature modules from
   `src/features/`. Page behavior belongs in the feature.
2. **One tool, one slice.** A tool has a page route in `src/routes/<tool>/`,
   schemas in `src/libs/schemas/`, a feature folder, and a registry entry tagged
   `category: "image" | "pdf" | "document" | "media"`. The home page renders
   one section per category.
   A tool that needs a server adds a `createServerFn` in `src/apis/<tool>.ts`
   with its Effect handler in `<tool>.server.ts`.
3. **Use Effect where it earns its keep.** Processing sits behind
   `Context.Service` classes (`ImageProcessor`, `PdfProcessor`). Typed failures
   are `Schema.TaggedError`s mapped once at the boundary that presents them.
4. **Schemas define the contract.** Request options, error bodies, limits, and
   format maps live in `src/libs/schemas/` and are used by both client and server.
5. **Nothing is stored.** Uploaded files are read into memory, processed, and
   turned into a download URL. Public media URLs are streamed through the
   same-origin Worker proxy and are not stored. Enforce `MAX_IMAGE_BYTES` and
   the PDF limits in `src/libs/schemas/pdf.ts`; the local media-to-MP3 tool
   caps its input in `src/libs/schemas/video.ts`.
6. **Process in the browser.** Cloudflare Workers Free allows 10 ms of CPU per
   request, so no native or WASM encoder can run on the server. Image work uses
   `@jsquash` codecs in the browser behind `ImageProcessor`; PDF merge/split and
   lossless compression use `@mssio/qpdf-wasm` behind `PdfProcessor`, pdf.js renders pages for PDF to
   image, and the `image-pdf-core` Rust/WASM package writes image-only PDFs. PDF
   to image uses the native canvas encoder for PNG/JPEG and a bounded worker
   pool for the other formats. Excel to PDF uses a Rust/WASM core (`calamine` +
   `pdf-writer`) that reads rows into a flat span arena and writes compressed PDF
   tables. Background removal uses a border-colour matte in a module worker,
   backed by the `background-removal-core` Rust/WASM package, with no model or JS
   fallback. Image to SVG is an output option in the image converter and uses
   `imagetracerjs`; the Rust VTracer experiment was reverted for photographic
   quality. Local and public-media audio conversion use Mediabunny for demuxing
   and browser-native decoding, with the LAME WASM encoder in a worker. Public
   YouTube and Instagram metadata is resolved by the `social-media-core`
   Rust/WASM package. A same-origin Worker proxy forwards only allowlisted
   platform and CDN hosts, strips credentials, validates redirects, rate-limits
   requests, and streams downloads without storing media. Private or
   login-protected content is not supported.
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
    boundary that needs it. The solid-background matte keeps alpha in a flat
    plane and feathers it with a one-pixel box blur; image-to-SVG works on one
    decoded `ImageData` buffer. `pnpm bench` measures the codecs; AVIF encodes
    at `speed: 9` (default 6 is ~9x slower), WebP at `method: 2` (default 4 is
    ~2x slower), and JPEG with `progressive: false` (~2x faster, ~1% larger).
14. **Tagged errors only.** No plain `Error` in `src/`; codec and PDF
    exceptions are mapped to tagged errors at the `Effect.tryPromise` boundary.
15. **PDF pages and image cards are sortable grids.** dnd-kit reorders page
    thumbnails and image-to-PDF cards; qpdf receives page runs in that order.
    qpdf detaches a raw `Uint8Array` it is given, so pass `File`/`Blob` inputs.
    Merge uses `--empty --pages` and split uses qpdf's page selection; bookmarks
    and forms are not preserved. Image to PDF embeds PNG and upright JPEG bytes
    as-is, and normalizes rotated JPEGs and other formats through
    `ImageProcessor` before `image-pdf-core` writes the pages.
16. **Rust/WASM cores are narrow and committed.** Excel to PDF keeps parsing and
    PDF writing in `packages/xlsx-pdf-core`; background removal keeps its matte
    in `packages/background-removal-core`; image-to-PDF assembly lives in
    `packages/image-pdf-core`; public media metadata resolution lives in
    `packages/social-media-core`. Generated packages under `src/libs/wasm/` are
    committed so the app build does not need Rust. CI runs the crate tests. Run
    `pnpm wasm:build` after changing any Rust source and `pnpm wasm:test` for
    the native crate tests.
