import { create } from "zustand"

import type {
  DocumentConversionOutput,
  DocumentConversionResult,
} from "@/features/document-tools/types"

interface PdfToMarkdownState {
  readonly file: File | null
  readonly result: DocumentConversionResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: DocumentConversionOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const usePdfToMarkdownStore = create<PdfToMarkdownState>()((set, get) => ({
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
