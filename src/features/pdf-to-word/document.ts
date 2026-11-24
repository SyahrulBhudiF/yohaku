import { Document, Packer, Paragraph, TextRun } from "docx"

import type { ExtractedPdfText } from "@/libs/utils/pdf/extract-text-rows"

export const createWordDocument = (pages: ExtractedPdfText) => {
  const children = pages.pages.flatMap((rows, pageIndex) => {
    if (rows.length === 0) {
      return [new Paragraph({ pageBreakBefore: pageIndex > 0, text: "" })]
    }

    return rows.map(
      (row, rowIndex) =>
        new Paragraph({
          pageBreakBefore: pageIndex > 0 && rowIndex === 0,
          children: [new TextRun(row.text)],
          spacing: { after: 80 },
        }),
    )
  })

  return new Document({ sections: [{ children }] })
}

export const createWordBlob = (pages: ExtractedPdfText) => Packer.toBlob(createWordDocument(pages))
