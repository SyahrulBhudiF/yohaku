import { GIFEncoder, applyPalette, quantize } from "gifenc"
import { describe, expect, it } from "vitest"

import { isAnimatedGif } from "@/features/video-to-gif/gif-validation"

const createGif = (frameCount: number) => {
  const gif = GIFEncoder()

  for (let frame = 0; frame < frameCount; frame += 1) {
    const rgba = new Uint8Array([frame * 100, 0, 255 - frame * 100, 255])
    const palette = quantize(rgba, 16)
    const indexed = applyPalette(rgba, palette)

    gif.writeFrame(indexed, 1, 1, {
      palette,
      delay: 100,
      ...(frame === 0 ? { repeat: 0 } : {}),
    })
  }

  gif.finish()

  return gif.bytes()
}

describe("isAnimatedGif", () => {
  it("accepts a valid animated GIF with multiple image frames", () => {
    expect(isAnimatedGif(createGif(2))).toBe(true)
  })

  it("rejects a still GIF, invalid magic, and a truncated animation", () => {
    expect(isAnimatedGif(createGif(1))).toBe(false)
    expect(isAnimatedGif(new Uint8Array([1, 2, 3]))).toBe(false)

    const truncated = createGif(2).slice(0, -1)

    expect(isAnimatedGif(truncated)).toBe(false)
  })
})
