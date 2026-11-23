# image-pdf-core

Rust/WASM image-only PDF writer.

PNG inputs are decoded, Flate-compressed, and embedded as RGB with an optional
SMask for alpha. JPEG inputs stay DCT-encoded and are embedded byte-for-byte.
Page geometry is stored in a `soa-rs` `Soa<PageLayout>` and supports `fit` and
A4 page sizes.

Build with `pnpm wasm:build`; test with `pnpm wasm:test`.
