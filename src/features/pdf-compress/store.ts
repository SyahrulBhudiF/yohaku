import { create } from "zustand"

export interface CompressedPdfResult {
  readonly url: string
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly pages: number
}

type ResultInput = Omit<CompressedPdfResult, "url"> & { readonly blob: Blob }

interface CompressPdfState {
  readonly file: File | null
  readonly result: CompressedPdfResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: ResultInput) => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const useCompressPdfStore = create<CompressPdfState>()((set, get) => ({
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
