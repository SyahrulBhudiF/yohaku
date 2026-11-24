import type { TextItem } from "pdfjs-dist/types/src/display/api"

export interface PdfTextCell {
  readonly x: number
  readonly text: string
}

export interface PdfTextRow {
  readonly y: number
  readonly cells: readonly PdfTextCell[]
  readonly text: string
}

export const groupPdfTextRows = (items: readonly TextItem[]): PdfTextRow[] => {
  const spans = items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      x: item.transform[4],
      y: item.transform[5],
      height: Math.max(item.height, item.transform[3], 1),
      width: item.width,
      text: item.str.trim(),
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x)

  const rows: Array<{ y: number; spans: typeof spans }> = []

  for (const span of spans) {
    const previous = rows.at(-1)
    const tolerance = Math.max(2, span.height * 0.35)

    if (!previous || Math.abs(previous.y - span.y) > tolerance) {
      rows.push({ y: span.y, spans: [span] })
    } else {
      previous.spans.push(span)
    }
  }

  return rows.map(({ y, spans: rowSpans }) => {
    const cells: Array<{ x: number; text: string }> = []
    let previousSpan: (typeof rowSpans)[number] | undefined

    for (const span of rowSpans) {
      const previous = cells.at(-1)
      const gap = previousSpan ? span.x - previousSpan.x - previousSpan.width : 0
      const columnGap = Math.max(12, span.height * 1.8)

      if (!previous || gap > columnGap) {
        cells.push({ x: span.x, text: span.text })
      } else {
        previous.text = `${previous.text} ${span.text}`
      }

      previousSpan = span
    }

    return { y, cells, text: cells.map((cell) => cell.text).join("\t") }
  })
}
