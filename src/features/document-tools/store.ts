import { create } from "zustand"

export interface ExcelToPdfResult {
  readonly url: string
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
}

type ExcelToPdfResultInput = Omit<ExcelToPdfResult, "url"> & { readonly blob: Blob }

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

interface ExcelToPdfState {
  readonly file: File | null
  readonly result: ExcelToPdfResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: ExcelToPdfResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useExcelToPdfStore = create<ExcelToPdfState>()((set, get) => ({
  file: null,
  result: null,
  setFile: (file) => {
    revoke(get().result?.url)
    set({ file, result: null })
  },
  setResult: ({ blob, ...result }) => {
    revoke(get().result?.url)
    set({ result: { ...result, url: URL.createObjectURL(blob) } })
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
