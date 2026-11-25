import { create } from "zustand"

export interface PowerPointToPdfResult {
  readonly url: string
  readonly fileName: string
  readonly outputBytes: number
  readonly inputBytes: number
}

type ResultInput = Omit<PowerPointToPdfResult, "url"> & { readonly blob: Blob }

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

interface PowerPointToPdfState {
  readonly file: File | null
  readonly result: PowerPointToPdfResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: ResultInput) => void
  readonly reset: () => void
}

export const usePowerPointToPdfStore = create<PowerPointToPdfState>()((set, get) => ({
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
