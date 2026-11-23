import init, {
  remove_background,
} from "@/libs/wasm/background-removal-core/background_removal_core.js"

let ready: Promise<unknown> | null = null

/**
 * Runs the Rust matte core when its small WASM module is available. The caller
 * keeps the JS matte as a fallback so a missing or failed WASM load never
 * breaks the tool.
 */
export const removeBackgroundWasm = async (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8ClampedArray | null> => {
  try {
    ready ??= init()
    await ready

    const input = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    const output = remove_background(input, width, height)

    if (output.length !== data.length) {
      return null
    }

    return new Uint8ClampedArray(output)
  } catch {
    return null
  }
}
