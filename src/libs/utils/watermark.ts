import type { WatermarkPosition } from "@/libs/schemas/watermark"

export interface WatermarkPlacement {
  readonly x: number
  readonly y: number
  readonly angle: number
}

export interface WatermarkLayoutInput {
  readonly width: number
  readonly height: number
  readonly markWidth: number
  readonly markHeight: number
  readonly position: WatermarkPosition
  readonly rotation: number
}

const MARGIN_RATIO = 0.04
const MAX_TILED_MARKS = 400

/** Text size is a percentage of the image width, capped to stay legible. */
export const watermarkFontSize = (width: number, size: number) =>
  Math.max(12, Math.round((Math.max(1, width) * size) / 100 / 4))

/** Logo width is a percentage of the image width. */
export const watermarkLogoWidth = (width: number, size: number) =>
  Math.max(12, Math.round((Math.max(1, width) * size) / 100))

/**
 * Returns the center point of each watermark mark. Single marks use the
 * requested anchor; tiled marks cover the canvas on a rotated grid.
 */
export const watermarkPlacements = (
  input: WatermarkLayoutInput,
): ReadonlyArray<WatermarkPlacement> => {
  const width = Math.max(1, input.width)
  const height = Math.max(1, input.height)
  const markWidth = Math.max(1, input.markWidth)
  const markHeight = Math.max(1, input.markHeight)
  const margin = Math.round(Math.min(width, height) * MARGIN_RATIO)
  const left = margin + markWidth / 2
  const right = width - margin - markWidth / 2
  const top = margin + markHeight / 2
  const bottom = height - margin - markHeight / 2
  const middleX = width / 2
  const middleY = height / 2

  if (input.position === "tiled") {
    const spacingX = Math.max(markWidth * 1.8, 24)
    const spacingY = Math.max(markHeight * 2.2, 24)
    const diagonal = Math.hypot(width, height)
    const startX = -diagonal / 2
    const startY = -diagonal / 2
    const endX = width + diagonal / 2
    const endY = height + diagonal / 2
    const placements: Array<WatermarkPlacement> = []
    let row = 0

    for (let y = startY; y <= endY; y += spacingY) {
      const offset = row % 2 === 0 ? 0 : spacingX / 2

      for (let x = startX + offset; x <= endX; x += spacingX) {
        placements.push({ x, y, angle: input.rotation })

        if (placements.length >= MAX_TILED_MARKS) {
          return placements
        }
      }

      row += 1
    }

    return placements
  }

  const x = input.position.includes("left")
    ? left
    : input.position.includes("right")
      ? right
      : middleX
  const y = input.position.startsWith("top")
    ? top
    : input.position.startsWith("bottom")
      ? bottom
      : middleY

  return [{ x, y, angle: input.rotation }]
}
