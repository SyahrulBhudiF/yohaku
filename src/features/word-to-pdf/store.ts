import { create } from "zustand"

import type { WordToPdfOutput } from "./process"

export type WordToPdfResult = Omit<WordToPdfOutput, "blob"> & { readonly url: string }

interface WordToPdfState {
  readonly file: File | null
  readonly result: WordToPdfResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: WordToPdfOutput) => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const useWordToPdfStore = create<WordToPdfState>()((set, get) => ({
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
