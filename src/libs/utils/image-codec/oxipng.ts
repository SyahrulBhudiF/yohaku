import init, { initSync, optimise } from "@jsquash/oxipng/codec/pkg/squoosh_oxipng.js"

let ready: Promise<unknown> | null = null

/**
 * Initializes the single-threaded Oxipng build. Tests pass a compiled module;
 * the browser and worker fetch the wasm file next to the generated glue.
 */
export const initOptimizePng = (module?: WebAssembly.Module): Promise<unknown> => {
  ready ??= module ? Promise.resolve(initSync(module)) : init()

  return ready
}

/**
 * Losslessly recompresses a PNG in place. Oxipng preserves the palette and
 * transparency, unlike decoding to RGBA and running a plain PNG encoder.
 */
export const optimizePng = async (bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
  await initOptimizePng()

  return new Uint8Array(optimise(bytes, 2, false, false))
}
