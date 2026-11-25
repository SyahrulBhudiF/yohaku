import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { simd } from "wasm-feature-detect"

import { initOptimizePng } from "@/libs/utils/image-codec/oxipng"

// The codecs expect a browser `ImageData`; Node only has the wasm modules.
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class {
    readonly data: Uint8ClampedArray
    readonly width: number
    readonly height: number

    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data
      this.width = width
      this.height = height
    }
  } as unknown as typeof ImageData
}

const compileWasm = async (specifier: string) =>
  WebAssembly.compile(await readFile(fileURLToPath(import.meta.resolve(specifier))))

/**
 * Node cannot fetch the codecs' `file://` wasm, so each codec is handed a
 * compiled module before the processor lazily imports it.
 */
export const initImageCodecs = async () => {
  const pngModule = await compileWasm("@jsquash/png/codec/pkg/squoosh_png_bg.wasm")
  const webpEncoder = (await simd())
    ? "@jsquash/webp/codec/enc/webp_enc_simd.wasm"
    : "@jsquash/webp/codec/enc/webp_enc.wasm"

  await Promise.all([
    import("@jsquash/png/encode").then((codec) => codec.init(pngModule)),
    import("@jsquash/png/decode").then((codec) => codec.init(pngModule)),
    compileWasm("@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm").then(initOptimizePng),
    import("@jsquash/jpeg/encode").then(async (codec) =>
      codec.init(await compileWasm("@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm")),
    ),
    import("@jsquash/jpeg/decode").then(async (codec) =>
      codec.init(await compileWasm("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm")),
    ),
    import("@jsquash/webp/encode").then(async (codec) =>
      codec.init(await compileWasm(webpEncoder)),
    ),
    import("@jsquash/webp/decode").then(async (codec) =>
      codec.init(await compileWasm("@jsquash/webp/codec/dec/webp_dec.wasm")),
    ),
    import("@jsquash/avif/encode").then(async (codec) =>
      codec.init(await compileWasm("@jsquash/avif/codec/enc/avif_enc.wasm")),
    ),
    import("@jsquash/avif/decode").then(async (codec) =>
      codec.init(await compileWasm("@jsquash/avif/codec/dec/avif_dec.wasm")),
    ),
  ])
}

export const makePng = async (width = 64, height = 48) => {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let index = 0; index < width * height; index++) {
    data[index * 4] = (index * 7) % 256
    data[index * 4 + 1] = (index * 13) % 256
    data[index * 4 + 2] = (index * 29) % 256
    data[index * 4 + 3] = 255
  }

  const encode = (await import("@jsquash/png/encode")).default
  const png = await encode(new ImageData(data, width, height))

  return new Uint8Array(png)
}
