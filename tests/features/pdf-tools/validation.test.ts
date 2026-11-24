import { describe, expect, it } from "vitest"

import { MAX_PDF_TOTAL_BYTES } from "@/libs/schemas/pdf"
import { isPdfBatchWithinSizeLimit } from "@/features/pdf-tools/validation"

describe("isPdfBatchWithinSizeLimit", () => {
  it("accepts a batch exactly at the combined PDF limit", () => {
    expect(MAX_PDF_TOTAL_BYTES).toBe(50 * 1024 * 1024)
    expect(isPdfBatchWithinSizeLimit(37 * 1024 * 1024, 13 * 1024 * 1024)).toBe(true)
  })

  it("rejects a batch one byte over the combined PDF limit", () => {
    expect(isPdfBatchWithinSizeLimit(MAX_PDF_TOTAL_BYTES, 1)).toBe(false)
  })
})
