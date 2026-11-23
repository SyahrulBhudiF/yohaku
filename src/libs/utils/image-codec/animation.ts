export interface AnimationFrame {
  readonly image: ImageData
  readonly delayMs: number
}

export interface AnimatedImage {
  readonly width: number
  readonly height: number
  readonly frames: ReadonlyArray<AnimationFrame>
}

export type AnimatedFormat = "gif" | "webp"

export const MAX_ANIMATION_FRAMES = 300
export const MAX_ANIMATION_PIXELS = 50_000_000

const FORMAT_LABEL: Record<AnimatedFormat, string> = { gif: "GIF", webp: "WebP" }

export const animationErrorMessage = (source: AnimatedFormat, target: AnimatedFormat): string => {
  const label = source === "gif" ? "GIF" : "animated WebP"

  return source === target
    ? `Could not re-encode this ${label}.`
    : `Could not convert this ${label} to ${FORMAT_LABEL[target]}.`
}

/**
 * Animated files are decoded fully in memory, so cap the total pixel work
 * before allocating one full canvas per frame.
 */
export const isWithinAnimationLimits = (
  width: number,
  height: number,
  frameCount: number,
): boolean =>
  frameCount > 0 &&
  frameCount <= MAX_ANIMATION_FRAMES &&
  width * height * frameCount <= MAX_ANIMATION_PIXELS
