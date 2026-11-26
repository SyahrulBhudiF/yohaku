import { assert, describe, it } from "@effect/vitest"

import { watermarkFontSize, watermarkLogoWidth, watermarkPlacements } from "@/libs/utils/watermark"

describe("watermark layout", () => {
  it("anchors a mark inside each corner and the center", () => {
    const base = {
      width: 1000,
      height: 800,
      markWidth: 100,
      markHeight: 50,
      rotation: 0,
    }
    const topLeft = watermarkPlacements({ ...base, position: "top-left" })
    const bottomRight = watermarkPlacements({ ...base, position: "bottom-right" })
    const center = watermarkPlacements({ ...base, position: "center" })

    assert.deepEqual(topLeft, [{ x: 82, y: 57, angle: 0 }])
    assert.deepEqual(bottomRight, [{ x: 918, y: 743, angle: 0 }])
    assert.deepEqual(center, [{ x: 500, y: 400, angle: 0 }])
  })

  it("covers the canvas with tiled marks at the requested angle", () => {
    const placements = watermarkPlacements({
      width: 1000,
      height: 800,
      markWidth: 100,
      markHeight: 50,
      position: "tiled",
      rotation: -30,
    })

    assert.isAbove(placements.length, 10)
    assert.isAtMost(placements.length, 400)
    assert.isTrue(placements.every((placement) => placement.angle === -30))
  })

  it("scales text and logos from the image width", () => {
    assert.strictEqual(watermarkFontSize(1000, 20), 50)
    assert.strictEqual(watermarkFontSize(10, 20), 12)
    assert.strictEqual(watermarkLogoWidth(1000, 20), 200)
  })
})
