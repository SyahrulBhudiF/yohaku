import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"

import { convertCsvExcel, readCsvExcelSheets } from "@/features/csv-excel/process"

const csvFile = (content: string, name = "people.csv") =>
  new File([content], name, { type: "text/csv" })

const workbookFile = () => {
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["name", "age"],
      ["Ada", 36],
    ]),
    "People",
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["city", "country"],
      ["Tokyo", "Japan"],
    ]),
    "Places",
  )
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

  return new File([bytes], "book.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

describe("CSV and Excel conversion", () => {
  it("turns a CSV into an Excel workbook", async () => {
    const output = await convertCsvExcel({
      file: csvFile("name,age\nAda,36\nGrace,85\n"),
      mode: "csv-to-excel",
    })

    expect(output.fileName).toBe("people.xlsx")
    expect(output.blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    expect(output.inputBytes).toBeGreaterThan(0)
    expect(output.outputBytes).toBeGreaterThan(0)
    expect(output.sheets).toEqual(["Sheet1"])

    const workbook = XLSX.read(new Uint8Array(await output.blob.arrayBuffer()), { type: "array" })
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Sheet1!, { header: 1 })

    expect(rows).toEqual([
      ["name", "age"],
      ["Ada", 36],
      ["Grace", 85],
    ])
  })

  it("lists worksheets and exports the selected worksheet as CSV with a BOM", async () => {
    const file = workbookFile()

    expect(await readCsvExcelSheets(file)).toEqual(["People", "Places"])

    const output = await convertCsvExcel({
      file,
      mode: "excel-to-csv",
      sheet: "Places",
    })

    expect(output.fileName).toBe("book-Places.csv")
    expect(output.sheet).toBe("Places")
    expect(output.blob.type).toBe("text/csv;charset=utf-8")

    const bytes = new Uint8Array(await output.blob.arrayBuffer())
    const text = await output.blob.text()

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(text).toContain("city,country")
    expect(text).toContain("Tokyo,Japan")
    expect(text).not.toContain("Ada")
  })

  it("defaults to the first worksheet when none is selected", async () => {
    const output = await convertCsvExcel({ file: workbookFile(), mode: "excel-to-csv" })

    expect(output.sheet).toBe("People")
    expect(await output.blob.text()).toContain("Ada,36")
  })

  it("rejects a file that does not match the selected direction", async () => {
    await expect(convertCsvExcel({ file: workbookFile(), mode: "csv-to-excel" })).rejects.toThrow(
      "Choose a CSV file.",
    )
  })
})
