import init, { build_pdf, initSync } from "@/libs/wasm/image-pdf-core/image_pdf_core.js"

import type { PdfImageInput } from "./pdf/images-to-pdf"

let ready: Promise<unknown> | null = null

/** Initializes the Rust PDF core synchronously for Node tests. */
export const initImagePdfForTests = (module: WebAssembly.Module) => {
  initSync({ module })
  ready = Promise.resolve()
}

/** Builds an image-only PDF with the Rust core. */
export const imagesToPdfWasm = async (
  images: ReadonlyArray<PdfImageInput>,
  pageSize: "fit" | "a4",
): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (typeof window === "undefined" && ready === null) {
    return null
  }

  try {
    const total = images.reduce((sum, image) => sum + image.data.byteLength, 0)
    const data = new Uint8Array(total)
    const lengths = new Uint32Array(images.length)
    const formats = new Uint8Array(images.length)
    let offset = 0

    for (const [index, image] of images.entries()) {
      data.set(image.data, offset)
      lengths[index] = image.data.byteLength
      formats[index] = image.format === "png" ? 0 : 1
      offset += image.data.byteLength
    }

    ready ??= init()
    await ready

    const output = build_pdf(data, lengths, formats, pageSize)

    return output.length > 0 ? new Uint8Array(output) : null
  } catch {
    return null
  }
}
