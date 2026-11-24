import init, {
  remove_background,
} from "@/libs/wasm/background-removal-core/background_removal_core.js"

let ready: Promise<unknown> | null = null

/**
 * Runs the Rust matte core. The caller reports a tagged error when the module
 * fails; there is no JS matte fallback.
 */
export const removeBackgroundWasm = async (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8ClampedArray | null> => {
  try {
    ready ??= init().catch((cause: unknown) => {
      ready = null
      throw cause
    })
    await ready

    const input = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    const output = remove_background(input, width, height)

    if (output.length !== data.length) {
      return null
    }

    return output
  } catch {
    return null
  }
}
