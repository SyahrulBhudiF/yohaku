import { readFileSync } from "node:fs"

import { Document, Packer, Paragraph } from "docx"
import { beforeAll, test } from "vitest"

import { convert_docx_to_pdf, initSync } from "@/libs/wasm/word-pdf-core/word_pdf_core.js"

const wasmPath = new URL(
  "../../../src/libs/wasm/word-pdf-core/word_pdf_core_bg.wasm",
  import.meta.url,
)
const PAGE_COUNTS = [10, 100]
const files = new Map<number, Uint8Array>()

initSync({ module: readFileSync(wasmPath) })

beforeAll(async () => {
  for (const pageCount of PAGE_COUNTS) {
    const children = []

    for (let page = 1; page <= pageCount; page++) {
      for (let row = 1; row <= 24; row++) {
        children.push(
          new Paragraph({
            pageBreakBefore: page > 1 && row === 1,
            text: `Page ${page} · Row ${row} · searchable report content`,
          }),
        )
      }
    }

    const document = new Document({ sections: [{ children }] })

    files.set(pageCount, new Uint8Array(await Packer.toBuffer(document)))
  }
})

for (const pageCount of PAGE_COUNTS) {
  test(`renders ${pageCount} DOCX pages to PDF`, { timeout: 120_000 }, async ({ bench }) => {
    const bytes = files.get(pageCount)!

    await bench(
      `jubarte Rust/WASM → PDF · ${pageCount} pages · ${bytes.byteLength} bytes`,
      { writeResult: `.amp/in/bench-word-pdf-${pageCount}.json` },
      () => convert_docx_to_pdf(bytes),
    ).run()
  })
}
