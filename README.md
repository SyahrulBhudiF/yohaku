# Yohaku

Yohaku is a browser-based toolkit for working with images, PDFs, documents, and media. Local files are processed in your browser and are never stored. Public video links use an allowlisted, same-origin streaming proxy; media is not stored by Yohaku.

**Try it:** [yohaku.ryuko.my.id](https://yohaku.ryuko.my.id)

## Tools

- **Images:** convert and compress PNG, JPEG, WebP, AVIF, GIF, and TIFF, and open HEIC/HEIF photos (exported as JPEG when keeping the original format); preserve animation when converting animated GIF/WebP to GIF or WebP; remove solid studio backgrounds; trace images to SVG.
- **PDF:** merge, split, reorganize, protect, and sign PDFs; render pages to images; convert PDF text to Word or Excel; and create PDFs from images.
- **Documents:** convert Word documents and Excel worksheets to PDF.
- **Media:** download public YouTube videos, Instagram Reels, and Facebook videos, extract their audio as MP3, or convert a local video/audio file to MP3.

Local files are processed in your browser and are not uploaded or stored. Public video downloads are streamed through a same-origin Cloudflare Worker proxy restricted to YouTube, Instagram, Facebook, and their media CDNs; the Worker does not save media. Private or login-protected posts are not supported. CPU-intensive processing stays client-side to fit Workers runtime limits. Background removal targets uniform backgrounds and is not an AI subject-segmentation tool. Excel export focuses on table data; it does not preserve formulas, charts, or merged cells.

## Performance

Median timings from `pnpm bench` on a 2 vCPU AMD EPYC development machine running Node.js 26. These are codec and core benchmarks, not browser measurements; real devices and files will vary.

| Operation             | Fixture                                      |     Median |
| --------------------- | -------------------------------------------- | ---------: |
| Images to PDF         | 10 × 1200 × 800 PNG → one PDF                |     300 ms |
| Images to PDF         | 10 × 1200 × 800 JPEG → one PDF (passthrough) |      10 ms |
| PDF text extraction   | 100 pages                                    |     196 ms |
| PDF to Word           | 100 pages → DOCX                             |     256 ms |
| PDF to Excel          | 100 pages → XLSX                             |     240 ms |
| Word to PDF           | 100-page DOCX → PDF                          |     372 ms |
| PDF page organization | Reorder 50 pages and rotate one              |      16 ms |
| PDF protection        | AES-256 protect / unlock 50 pages            | 21 / 23 ms |
| PDF compression       | Representative PDF, lossless qpdf            |      17 ms |

The benchmark fixtures live in `tests/**/*.bench.ts`. Run them with `pnpm bench`; results are written under `.amp/in/`.

## Development

Requirements: Node.js 24 or newer, pnpm 12, and Rust with the `wasm32-unknown-unknown` target for rebuilding WebAssembly packages.

```sh
pnpm install
pnpm dev              # Local Vite development server
pnpm dev:cloudflare   # Development with Alchemy/Cloudflare bindings
pnpm check            # Formatting, lint, and type checks
pnpm test:run         # Unit tests
pnpm build            # Production build
pnpm bench            # Image codec benchmarks
pnpm wasm:test        # Rust core tests
pnpm wasm:build       # Rebuild generated Rust/WASM packages
```

Run one test file with `pnpm test:run tests/path/to/test.test.ts`. Read [AGENTS.md](AGENTS.md) and [.agents/CONTEXT.md](.agents/CONTEXT.md) before making architectural changes. Rust crates live under `packages/`; their generated browser packages are committed under `src/libs/wasm/` so the app build does not require Rust.

## Architecture

Yohaku is a TanStack Start application deployed to Cloudflare Workers with Alchemy. Feature pages and UI live in `src/features/`; routes stay thin. Client-side processing is organized behind Effect services. Image codecs use WebAssembly where appropriate, PDF rendering uses pdf.js, PDF assembly and spreadsheet export use focused Rust/WASM cores, and media conversion uses Mediabunny with browser-native decoding and a LAME WASM MP3 encoder in a worker. Public YouTube, Instagram, and Facebook link resolution uses a Rust/WASM adapter; the Worker only validates and streams allowlisted upstream requests. UI components use Base UI with Material Design 3 styling.

## Deployment

GitHub Actions checks changes and deploys `main` after checks pass. Configure the repository's `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` Actions secrets for deployment. The token needs the Cloudflare permissions documented in [AGENTS.md](AGENTS.md); never commit credentials.

For a manual production deployment, authenticate Alchemy with `pnpm exec alchemy profile edit --add Cloudflare`, then run:

```sh
pnpm run deploy
```

`pnpm run destroy` removes the production stack and its managed resources; use it only when intentionally decommissioning the deployment.

## License

See the repository license file, if present, for terms governing Yohaku's source code. Third-party libraries and codecs retain their own licenses.
