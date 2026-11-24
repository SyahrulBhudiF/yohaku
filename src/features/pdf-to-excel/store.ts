import { create } from "zustand"

import type { PdfToExcelOutput } from "./process"

export type PdfToExcelResult = Omit<PdfToExcelOutput, "blob"> & { readonly url: string }

interface PdfToExcelState {
  readonly file: File | null
  readonly result: PdfToExcelResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: PdfToExcelOutput) => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const usePdfToExcelStore = create<PdfToExcelState>()((set, get) => ({
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
  reset: () => {
    revoke(get().result?.url)
    set({ file: null, result: null })
  },
}))
