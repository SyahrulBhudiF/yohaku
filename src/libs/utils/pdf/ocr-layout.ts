import type { PdfOcrLine } from "@/libs/schemas/pdf"
import type { PdfTextRow } from "./text-layout"

export const groupOcrLines = (lines: ReadonlyArray<PdfOcrLine>): PdfTextRow[] => {
  const sorted = lines
    .filter((line) => line.text.trim().length > 0)
    .map((line) => ({ ...line, centerY: line.y + line.height / 2 }))
    .sort((left, right) => left.centerY - right.centerY || left.x - right.x)
  const rows: Array<{ centerY: number; height: number; lines: typeof sorted }> = []

  for (const line of sorted) {
    const previous = rows.at(-1)
    const tolerance = Math.max(2, line.height * 0.45)

    if (!previous || Math.abs(previous.centerY - line.centerY) > tolerance) {
      rows.push({ centerY: line.centerY, height: line.height, lines: [line] })
    } else {
      previous.lines.push(line)
      previous.height = Math.max(previous.height, line.height)
    }
  }

  return rows.map(({ centerY, height, lines: rowLines }) => {
    const cells: Array<{ x: number; text: string }> = []
    let previousLine: (typeof rowLines)[number] | undefined

    for (const line of rowLines.sort((left, right) => left.x - right.x)) {
      const previousCell = cells.at(-1)
      const gap = previousLine ? line.x - previousLine.x - previousLine.width : 0
      const columnGap = Math.max(12, height * 1.8)

      if (!previousCell || gap > columnGap) {
        cells.push({ x: line.x, text: line.text })
      } else {
        previousCell.text = `${previousCell.text} ${line.text}`
      }

      previousLine = line
    }

    return { y: -centerY, cells, text: cells.map((cell) => cell.text).join("\t") }
  })
}
