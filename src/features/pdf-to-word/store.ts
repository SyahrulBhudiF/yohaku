import { create } from "zustand"

import type { PdfToWordOutput } from "./process"

export type PdfToWordResult = Omit<PdfToWordOutput, "blob"> & { readonly url: string }

interface PdfToWordState {
  readonly file: File | null
  readonly result: PdfToWordResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: PdfToWordOutput) => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const usePdfToWordStore = create<PdfToWordState>()((set, get) => ({
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
