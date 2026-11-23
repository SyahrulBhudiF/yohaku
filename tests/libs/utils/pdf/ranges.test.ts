import { assert, describe, it } from "@effect/vitest"

import { groupConsecutivePages } from "@/libs/utils/pdf/pages"
import { parsePageRanges, validatePageRanges } from "@/libs/utils/pdf/ranges"

describe("PDF page ranges", () => {
  it("parses page numbers and ranges", () => {
    const result = parsePageRanges("1-3, 5, 7-9", 10)

    assert.isTrue(result.ok)

    if (result.ok) {
      assert.deepEqual(result.ranges, [
        { start: 1, end: 3 },
        { start: 5, end: 5 },
        { start: 7, end: 9 },
      ])
    }
  })

  it("rejects an out-of-bounds range", () => {
    const result = parsePageRanges("1-11", 10)

    assert.isFalse(result.ok)
  })

  it("rejects a reversed range", () => {
    const result = parsePageRanges("5-3", 10)

    assert.isFalse(result.ok)
  })

  it("rejects non-numeric input", () => {
    const result = parsePageRanges("1-3, all", 10)

    assert.isFalse(result.ok)
  })

  it("rejects an empty range list", () => {
    const result = validatePageRanges([], 10)

    assert.isFalse(result.ok)
  })

  it("groups only consecutive pages from the same file", () => {
    const runs = groupConsecutivePages([
      { fileId: "a", pageNumber: 2 },
      { fileId: "a", pageNumber: 1 },
      { fileId: "b", pageNumber: 1 },
      { fileId: "a", pageNumber: 3 },
    ])

    assert.deepEqual(runs, [
      { fileId: "a", pages: [2, 1] },
      { fileId: "b", pages: [1] },
      { fileId: "a", pages: [3] },
    ])
  })
})
