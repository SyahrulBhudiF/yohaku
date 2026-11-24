import init, { build_pdf, initSync } from "@/libs/wasm/image-pdf-core/image_pdf_core.js"

import type { ImagePdfPageSize } from "@/libs/schemas/pdf"
import type { PdfImageInput } from "./pdf/images-to-pdf"

export type ImagePdfWasmResult =
  | { readonly ok: true; readonly bytes: Uint8Array<ArrayBuffer> }
  | { readonly ok: false; readonly message: string }

let ready: Promise<unknown> | null = null

/** Initializes the Rust PDF core synchronously for Node tests. */
export const initImagePdfForTests = (module: WebAssembly.Module) => {
  initSync({ module })
  ready = Promise.resolve()
}

/** Builds an image-only PDF with the Rust core. */
export const imagesToPdfWasm = async (
  images: ReadonlyArray<PdfImageInput>,
  pageSize: ImagePdfPageSize,
): Promise<ImagePdfWasmResult> => {
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

    ready ??= init().catch((cause: unknown) => {
      ready = null
      throw cause
    })
    await ready

    const output = build_pdf(data, lengths, formats, pageSize)

    if (output.length === 0) {
      return { ok: false, message: "Could not create the PDF." }
    }

    return { ok: true, bytes: output as Uint8Array<ArrayBuffer> }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error
          ? cause.message
          : typeof cause === "string" && cause.length > 0
            ? cause
            : "Could not create the PDF.",
    }
  }
}
