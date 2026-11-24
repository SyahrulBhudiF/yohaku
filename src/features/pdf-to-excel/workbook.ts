import * as XLSX from "xlsx"

import type { ExtractedPdfText } from "@/libs/utils/pdf/extract-text-rows"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export const createExcelBlob = (pages: ExtractedPdfText) => {
  const workbook = XLSX.utils.book_new()

  for (const [index, rows] of pages.pages.entries()) {
    const cellRows = rows.map((row) => row.cells.map((cell) => cell.text))
    const worksheet = XLSX.utils.aoa_to_sheet(cellRows)
    const columnWidths: number[] = []

    for (const row of cellRows) {
      for (const [columnIndex, cell] of row.entries()) {
        columnWidths[columnIndex] = Math.max(columnWidths[columnIndex] ?? 12, cell.length + 2)
      }
    }

    worksheet["!cols"] = columnWidths.map((width) => ({ wch: Math.min(48, width) }))
    XLSX.utils.book_append_sheet(workbook, worksheet, `Page ${index + 1}`)
  }

  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: false })

  return new Blob([bytes], { type: XLSX_MIME })
}
