import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

import {
  MAX_CSV_EXCEL_BYTES,
  type CsvExcelMode,
  type CsvExcelSheets,
} from "@/libs/schemas/csv-excel"
import { convertCsvExcel, readCsvExcelSheets } from "./process"
import { useCsvExcelStore } from "./store"

const isCsvFile = (file: File) =>
  file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv"

const isSpreadsheetFile = (file: File) =>
  /\.(xlsx|xls)$/i.test(file.name) ||
  file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
  file.type === "application/vnd.ms-excel"

export function useCsvExcel(mode: CsvExcelMode) {
  const { file, result, setFile, setResult, clearResult, reset } = useCsvExcelStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const sheets = useQuery<CsvExcelSheets>({
    queryKey: ["csv-excel-sheets", file?.name, file?.size, file?.lastModified],
    queryFn: () => (file ? readCsvExcelSheets(file) : Promise.resolve([])),
    enabled: file !== null && mode === "excel-to-csv",
    retry: false,
    staleTime: Infinity,
  })
  const convert = useMutation({
    mutationFn: convertCsvExcel,
    onSuccess: (output, input) => {
      if (useCsvExcelStore.getState().file === input.file) setResult(output)
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return

    convert.reset()
    setSelectionError(null)

    if (selected.size === 0) {
      setSelectionError("This file is empty.")

      return
    }

    if (selected.size > MAX_CSV_EXCEL_BYTES) {
      setSelectionError(`Files can be at most ${MAX_CSV_EXCEL_BYTES / 1024 / 1024} MB.`)

      return
    }

    if (mode === "csv-to-excel" && !isCsvFile(selected)) {
      setSelectionError("Choose a CSV file.")

      return
    }

    if (mode === "excel-to-csv" && !isSpreadsheetFile(selected)) {
      setSelectionError("Choose an XLSX or XLS workbook.")

      return
    }

    setFile(selected)
  }

  const clear = () => {
    convert.reset()
    setSelectionError(null)
    reset()
  }

  return {
    file,
    result,
    selectionError,
    sheets: sheets.data ?? [],
    sheetsPending: sheets.isPending,
    sheetsError: sheets.error?.message ?? null,
    convert,
    selectFile,
    clear,
    clearResult,
  }
}
