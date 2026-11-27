import { create } from "zustand"

import type { CsvExcelOutput } from "@/libs/schemas/csv-excel"

export type CsvExcelResult = CsvExcelOutput & {
  readonly url: string
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

interface CsvExcelState {
  readonly file: File | null
  readonly result: CsvExcelResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (output: CsvExcelOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useCsvExcelStore = create<CsvExcelState>()((set, get) => ({
  file: null,
  result: null,
  setFile: (file) => {
    revoke(get().result?.url)
    set({ file, result: null })
  },
  setResult: (output) => {
    revoke(get().result?.url)
    set({ result: { ...output, url: URL.createObjectURL(output.blob) } })
  },
  clearResult: () => {
    revoke(get().result?.url)
    set({ result: null })
  },
  reset: () => {
    revoke(get().result?.url)
    set({ file: null, result: null })
  },
}))
