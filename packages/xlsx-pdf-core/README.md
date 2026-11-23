# xlsx-pdf-core

Browser-side XLSX → PDF core for Yohaku. It reads the workbook with
`calamine` and writes a compressed PDF with `pdf-writer`.

## Build

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
pnpm wasm:build
pnpm wasm:test
```

`pnpm wasm:build` writes the browser package to
`src/libs/wasm/xlsx-pdf-core/`. The generated package is committed so the
Cloudflare build does not need a Rust toolchain.

## Modules

- `lib.rs`: public `convert` API and the WASM export only.
- `parse.rs`: XLSX parsing and cell normalization.
- `model.rs`: flat span arena, sheet data, and page format.
- `layout.rs`: page geometry and the `soa-rs` column table.
- `render.rs`: text encoding, PDF content streams, and compression.
- `wasm.rs`: the `wasm-bindgen` export only.
- `error.rs` / `limits.rs`: typed errors and shared limits.

## Data-oriented layout

Parsing produces one flat row-major `Vec<Span>` per sheet. Cell text lives in a
single UTF-8 arena per sheet; a `Span` is two `u32`s. Column widths and x offsets
live in one `soa-rs` `Soa<Column>`, so the two fields are separate contiguous
arrays with one allocation. The render loop walks contiguous spans and only
allocates when a cell is actually truncated or needs a Windows-1252 conversion.
ASCII text is passed to the PDF as a borrowed byte slice.

## Benchmark

Orb, Node 26/V8, 10 columns, compressed PDF, warm runs:

| Workbook | Native |   WASM |
| -------- | -----: | -----: |
| 10k rows | 109 ms | 166 ms |
| 50k rows | 547 ms | 829 ms |

The generated WASM is about 662 KB raw / 370 KB gzip. A pre-DoD
`Vec<Vec<String>>` prototype measured 137 ms / 614 ms native; the flat layout is
about 26% faster at 10k rows and 12% faster at 50k rows. `soa-rs` is used for
maintainability of the column table, not as the main speedup.

## Limits

- XLSX and XLSM only. Formulas use the cached values stored in the workbook.
- 90,000 data rows and 2,000 PDF pages per run.
- The first non-empty row is treated as a header and repeated on every page.
- Standard Helvetica with WinAnsi encoding. Characters outside Windows-1252
  render as `?`; full Unicode needs an embedded font.
- Merged cells, charts, images, conditional formatting, and number formats are
  not reproduced. This is a clean table export, not a spreadsheet renderer.
