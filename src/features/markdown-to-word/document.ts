import { Document, HeadingLevel, Paragraph, Table, TableCell, TableRow, TextRun } from "docx"
import type { FileChild } from "docx"

import { parseMarkdown, parseMarkdownInline } from "@/libs/utils/markdown"

const headingStyles = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
]

export const createMarkdownDocument = (markdown: string) => {
  const children: FileChild[] = []

  for (const block of parseMarkdown(markdown)) {
    if (block.type === "rule") {
      children.push(
        new Paragraph({
          text: " ",
          border: { bottom: { color: "808080", space: 1, style: "single", size: 4 } },
        }),
      )

      continue
    }

    if (block.type === "table") {
      const width = Math.max(...block.rows.map((row) => row.length))
      const rows = block.rows.map(
        (row) =>
          new TableRow({
            children: Array.from({ length: width }, (_, columnIndex) => {
              const runs = parseMarkdownInline(row[columnIndex] ?? "").map(
                (run) =>
                  new TextRun({
                    text: run.link ? `${run.text} (${run.link})` : run.text,
                    ...(run.bold ? { bold: true } : {}),
                    ...(run.italics ? { italics: true } : {}),
                    ...(run.code ? { font: "Courier New" } : {}),
                  }),
              )

              return new TableCell({
                children: [new Paragraph({ children: runs.length ? runs : [new TextRun("")] })],
              })
            }),
          }),
      )

      children.push(new Table({ rows }))

      continue
    }

    const textRuns = block.runs.map(
      (run) =>
        new TextRun({
          text: run.link ? `${run.text} (${run.link})` : run.text,
          ...(run.bold ? { bold: true } : {}),
          ...(run.italics ? { italics: true } : {}),
          ...(run.code || block.type === "code" ? { font: "Courier New" } : {}),
          ...(block.type === "quote" ? { color: "5E665A" } : {}),
          ...(run.link ? { underline: { color: "4D6757" } } : {}),
        }),
    )

    const text = block.runs.map((run) => run.text).join("")
    const paragraphRuns =
      block.type === "list" && block.ordered
        ? [new TextRun(`1. ${text}`)]
        : textRuns.length > 0
          ? textRuns
          : [new TextRun(text)]

    children.push(
      new Paragraph({
        children: paragraphRuns,
        ...(block.type === "heading" ? { heading: headingStyles[block.level - 1]! } : {}),
        ...(block.type === "list" && !block.ordered ? { bullet: { level: 0 } } : {}),
        ...(block.type === "quote" ? { indent: { left: 360 } } : {}),
        spacing: { before: block.type === "heading" ? 180 : 0, after: 120 },
      }),
    )
  }

  return new Document({ sections: [{ children }] })
}
