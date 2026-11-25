import { create } from "zustand"

import type {
  DocumentConversionOutput,
  DocumentConversionResult,
} from "@/features/document-tools/types"

export type DocumentConversionStore = {
  readonly result: DocumentConversionResult | null
  readonly setResult: (result: DocumentConversionOutput) => void
  readonly clearResult: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const createDocumentConversionStore = () =>
  create<DocumentConversionStore>()((set, get) => ({
    result: null,
    setResult: ({ blob, ...result }) => {
      revoke(get().result?.url)
      set({ result: { ...result, url: URL.createObjectURL(blob) } })
    },
    clearResult: () => {
      revoke(get().result?.url)
      set({ result: null })
    },
  }))
