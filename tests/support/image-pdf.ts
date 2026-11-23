import { readFileSync } from "node:fs"

import { initImagePdfForTests } from "@/libs/utils/image-pdf-wasm"

export const initImagePdf = () =>
  initImagePdfForTests(
    new WebAssembly.Module(
      readFileSync(
        new URL("../../src/libs/wasm/image-pdf-core/image_pdf_core_bg.wasm", import.meta.url),
      ),
    ),
  )
