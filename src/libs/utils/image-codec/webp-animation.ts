import type { AnimatedImage, AnimationFrame } from "./animation"
import { isWithinAnimationLimits } from "./animation"
import { encodeAnimatedWebp, encodeGifAnimation } from "./gif"

const VP8X_ANIMATION_FLAG = 0x02

const fourCC = (input: Uint8Array, offset: number): string =>
  String.fromCharCode(input[offset]!, input[offset + 1]!, input[offset + 2]!, input[offset + 3]!)

/**
 * An animated WebP is an extended file whose first chunk is `VP8X` with the
 * animation flag set. Reading the header is enough; decoding stays lazy.
 */
export const isAnimatedWebp = (input: Uint8Array): boolean => {
  if (input.byteLength < 21) {
    return false
  }

  if (fourCC(input, 0) !== "RIFF" || fourCC(input, 8) !== "WEBP") {
    return false
  }

  return fourCC(input, 12) === "VP8X" && (input[20]! & VP8X_ANIMATION_FLAG) !== 0
}

export const decodeWebpAnimation = async (input: Uint8Array): Promise<AnimatedImage | null> => {
  const { decodeAnimation } = await import("wasm-webp/dist/esm/index.js")
  const decoded = await decodeAnimation(input, true)

  if (!decoded || decoded.length === 0) {
    return null
  }

  const width = decoded[0]!.width
  const height = decoded[0]!.height

  if (!isWithinAnimationLimits(width, height, decoded.length)) {
    return null
  }

  // libwebp's animation decoder returns composited full-canvas frames. A
  // partial frame would break the encoders, which assume one full frame each.
  if (decoded.some((frame) => frame.width !== width || frame.height !== height)) {
    return null
  }

  const frames: Array<AnimationFrame> = decoded.map((frame) => ({
    image: new ImageData(new Uint8ClampedArray(frame.data), width, height),
    delayMs: Math.max(10, frame.duration),
  }))

  return { width, height, frames }
}

export const transcodeWebpAnimation = async (
  input: Uint8Array,
  format: "gif" | "webp",
  quality: number,
): Promise<Uint8Array<ArrayBuffer> | null> => {
  const animation = await decodeWebpAnimation(input)

  if (!animation) {
    return null
  }

  return format === "webp"
    ? encodeAnimatedWebp(animation, quality)
    : encodeGifAnimation(animation, quality)
}
