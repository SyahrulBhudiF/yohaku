import { describe, expect, it } from "vitest"
import type { TextItem } from "pdfjs-dist/types/src/display/api"

import { groupPdfTextRows } from "@/libs/utils/pdf/text-layout"

const textItem = (str: string, x: number, y: number, width: number): TextItem =>
  ({
    str,
    transform: [1, 0, 0, 10, x, y],
    width,
    height: 10,
  }) as TextItem

describe("groupPdfTextRows", () => {
  it("groups words by baseline and uses wide gaps as columns", () => {
    const rows = groupPdfTextRows([
      textItem("Amount", 220, 720, 40),
      textItem("Paper", 72, 720, 35),
      textItem("120", 220, 690, 18),
      textItem("Recycled", 72, 690, 48),
      textItem("sheets", 124, 690, 30),
    ])

    expect(rows).toEqual([
      {
        y: 720,
        cells: [
          { x: 72, text: "Paper" },
          { x: 220, text: "Amount" },
        ],
        text: "Paper\tAmount",
      },
      {
        y: 690,
        cells: [
          { x: 72, text: "Recycled sheets" },
          { x: 220, text: "120" },
        ],
        text: "Recycled sheets\t120",
      },
    ])
  })
})
