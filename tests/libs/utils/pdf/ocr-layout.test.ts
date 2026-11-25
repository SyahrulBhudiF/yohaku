import { describe, expect, it } from "vitest"

import { groupOcrLines } from "@/libs/utils/pdf/ocr-layout"

describe("groupOcrLines", () => {
  it("restores top-to-bottom order and separates distant columns", () => {
    const rows = groupOcrLines([
      { x: 380, y: 11, width: 50, height: 12, text: "Right", score: 0.99 },
      { x: 20, y: 12, width: 43, height: 12, text: "Hello", score: 0.98 },
      { x: 72, y: 12, width: 35, height: 12, text: "there", score: 0.94 },
      { x: 20, y: 42, width: 40, height: 12, text: "Below", score: 0.97 },
    ])

    expect(rows.map((row) => row.text)).toEqual(["Hello there\tRight", "Below"])
  })

  it("drops empty recognition results", () => {
    expect(groupOcrLines([])).toEqual([])
    expect(groupOcrLines([{ x: 1, y: 1, width: 10, height: 10, text: "  ", score: 0.2 }])).toEqual(
      [],
    )
  })
})
