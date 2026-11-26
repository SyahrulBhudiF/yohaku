import { describe, expect, it } from "vitest"

import "../../support/image-codecs"
import {
  clampCropRect,
  computeResizeGeometry,
  cropRectForAspect,
  fitImageDataWithin,
  flattenOnWhite,
  moveCropRect,
  resizeCropRect,
  resizeImageData,
  type ResizeOptions,
} from "@/libs/utils/image-resize"

const options = (overrides: Partial<ResizeOptions> = {}): ResizeOptions => ({
  width: 100,
  height: 100,
  mode: "fit",
  crop: { x: 0, y: 0, width: 1, height: 1 },
  rotate: 0,
  flipX: false,
  flipY: false,
  ...overrides,
})

const image = (width: number, height: number, pixels: ReadonlyArray<number>) =>
  new ImageData(new Uint8ClampedArray(pixels), width, height)

describe("computeResizeGeometry", () => {
  it("fits the source inside the box without changing its aspect", () => {
    const geometry = computeResizeGeometry(400, 200, options({ width: 100, height: 100 }))

    expect(geometry.outputWidth).toBe(100)
    expect(geometry.outputHeight).toBe(50)
  })

  it("center-crops to the requested aspect before rotating", () => {
    const geometry = computeResizeGeometry(
      400,
      200,
      options({
        crop: { x: 0.25, y: 0, width: 0.5, height: 1 },
        rotate: 90,
        width: 100,
        height: 100,
      }),
    )

    expect(geometry.cropX).toBe(100)
    expect(geometry.cropWidth).toBe(200)
    expect(geometry.cropHeight).toBe(200)
    expect(geometry.rotatedWidth).toBe(200)
    expect(geometry.rotatedHeight).toBe(200)
    expect(geometry.outputWidth).toBe(100)
    expect(geometry.outputHeight).toBe(100)
  })

  it("fill crops the rotated image to the target aspect", () => {
    const geometry = computeResizeGeometry(
      400,
      200,
      options({ mode: "fill", width: 100, height: 100 }),
    )

    expect(geometry.mapWidth).toBe(200)
    expect(geometry.mapHeight).toBe(200)
    expect(geometry.mapX).toBe(100)
    expect(geometry.outputWidth).toBe(100)
    expect(geometry.outputHeight).toBe(100)
  })

  it("stretch keeps the exact requested dimensions", () => {
    const geometry = computeResizeGeometry(
      400,
      200,
      options({ mode: "stretch", width: 120, height: 80 }),
    )

    expect(geometry.outputWidth).toBe(120)
    expect(geometry.outputHeight).toBe(80)
  })
})

describe("crop geometry", () => {
  it("creates the largest centered crop for an aspect", () => {
    expect(cropRectForAspect(1, 800, 600)).toEqual({
      x: 0.125,
      y: 0,
      width: 0.75,
      height: 1,
    })
  })

  it("clamps a crop to the image bounds", () => {
    expect(clampCropRect({ x: -0.2, y: 0.9, width: 0.5, height: 0.5 })).toEqual({
      x: 0,
      y: 0.5,
      width: 0.5,
      height: 0.5,
    })
  })

  it("moves a crop without leaving the image", () => {
    expect(moveCropRect({ x: 0, y: 0, width: 0.5, height: 0.5 }, 1, 1)).toEqual({
      x: 0.5,
      y: 0.5,
      width: 0.5,
      height: 0.5,
    })
  })

  it("preserves the requested aspect on a non-square source", () => {
    const next = resizeCropRect(
      { x: 0.1, y: 0.1, width: 0.5, height: 2 / 3 },
      "e",
      0.1,
      0,
      1,
      4 / 3,
    )

    expect(next.width).toBeCloseTo(0.6)
    expect(next.height).toBeCloseTo(0.8)
    expect(next.y).toBeCloseTo(1 / 30, 3)
  })

  it("resizes an edge and preserves the requested aspect", () => {
    const next = resizeCropRect({ x: 0.1, y: 0.1, width: 0.4, height: 0.4 }, "e", 0.1, 0, 1, 1)

    expect(next.width).toBeCloseTo(0.5)
    expect(next.height).toBeCloseTo(0.5)
    expect(next.x).toBeCloseTo(0.1)
    expect(next.y).toBeCloseTo(0.05)
  })
})

describe("resizeImageData", () => {
  it("averages pixels when downscaling to one pixel", () => {
    const source = image(2, 1, [255, 0, 0, 255, 0, 0, 255, 255])
    const output = resizeImageData(source, options({ width: 1, height: 1, mode: "stretch" }))

    expect(output.width).toBe(1)
    expect(output.height).toBe(1)
    expect(Array.from(output.data)).toEqual([128, 0, 128, 255])
  })

  it("rotates 90 degrees clockwise", () => {
    const source = image(2, 1, [255, 0, 0, 255, 0, 0, 255, 255])
    const output = resizeImageData(
      source,
      options({ width: 1, height: 2, mode: "stretch", rotate: 90 }),
    )

    expect(output.width).toBe(1)
    expect(output.height).toBe(2)
    expect(Array.from(output.data.slice(0, 4))).toEqual([255, 0, 0, 255])
    expect(Array.from(output.data.slice(4, 8))).toEqual([0, 0, 255, 255])
  })

  it("flips horizontally", () => {
    const source = image(2, 1, [255, 0, 0, 255, 0, 0, 255, 255])
    const output = resizeImageData(
      source,
      options({ width: 2, height: 1, mode: "stretch", flipX: true }),
    )

    expect(Array.from(output.data.slice(0, 4))).toEqual([0, 0, 255, 255])
    expect(Array.from(output.data.slice(4, 8))).toEqual([255, 0, 0, 255])
  })
})

describe("fitImageDataWithin", () => {
  it("returns the same image when it already fits", () => {
    const source = image(10, 8, new Array(10 * 8 * 4).fill(0))

    expect(fitImageDataWithin(source, 10)).toBe(source)
  })

  it("downscales the longest side and preserves the aspect ratio", () => {
    const landscape = fitImageDataWithin(image(4, 2, new Array(4 * 2 * 4).fill(0)), 2)
    const portrait = fitImageDataWithin(image(2, 4, new Array(2 * 4 * 4).fill(0)), 2)

    expect([landscape.width, landscape.height]).toEqual([2, 1])
    expect([portrait.width, portrait.height]).toEqual([1, 2])
  })
})

describe("flattenOnWhite", () => {
  it("composites transparency onto white", () => {
    const source = image(1, 1, [255, 0, 0, 0])

    flattenOnWhite(source)

    expect(Array.from(source.data)).toEqual([255, 255, 255, 255])
  })
})
