# Yohaku

Yohaku is a browser-based toolkit for working with images and documents. Convert and compress images, remove uniform backgrounds, trace images to SVG, organize PDFs, and convert between images and PDF—all without uploading your files.

**Try it:** [yohaku.ryuko.my.id](https://yohaku.ryuko.my.id)

## Tools

- **Images:** convert and compress PNG, JPEG, WebP, AVIF, GIF, and TIFF; preserve animation when converting animated GIF/WebP to GIF or WebP; remove solid studio backgrounds; trace images to SVG.
- **PDF:** merge and split PDFs, render selected pages to images, place multiple drawn or image signatures, and create PDFs from one or more images.
- **Spreadsheets:** export Excel worksheets to PDF.

Files are processed locally in your browser and are not uploaded or stored by Yohaku. The app uses Cloudflare Workers to serve the site; CPU-intensive processing stays client-side to fit the Workers runtime limits. Background removal targets uniform backgrounds and is not an AI subject-segmentation tool. Excel export focuses on table data; it does not preserve formulas, charts, or merged cells.

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

Yohaku is a TanStack Start application deployed to Cloudflare Workers with Alchemy. Feature pages and UI live in `src/features/`; routes stay thin. Client-side processing is organized behind Effect services. Image codecs use WebAssembly where appropriate, PDF rendering uses pdf.js, PDF assembly and spreadsheet export use focused Rust/WASM cores, and UI components use Base UI with Material Design 3 styling.

## Deployment

GitHub Actions checks changes and deploys `main` after checks pass. Configure the repository's `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` Actions secrets for deployment. The token needs the Cloudflare permissions documented in [AGENTS.md](AGENTS.md); never commit credentials.

For a manual production deployment, authenticate Alchemy with `pnpm exec alchemy profile edit --add Cloudflare`, then run:

```sh
pnpm run deploy
```

`pnpm run destroy` removes the production stack and its managed resources; use it only when intentionally decommissioning the deployment.

## License

See the repository license file, if present, for terms governing Yohaku's source code. Third-party libraries and codecs retain their own licenses.
