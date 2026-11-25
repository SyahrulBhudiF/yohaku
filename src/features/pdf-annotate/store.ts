import { create } from "zustand"

import type { PdfFileEntry } from "@/features/pdf-tools/store"

export interface PdfAnnotateResult {
  readonly url: string
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly pages: number
}

type ResultInput = Omit<PdfAnnotateResult, "url"> & { readonly blob: Blob }

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

interface PdfAnnotateState {
  readonly file: PdfFileEntry | null
  readonly logo: File | null
  readonly logoUrl: string | null
  readonly result: PdfAnnotateResult | null
  readonly setFile: (file: PdfFileEntry | null) => void
  readonly setLogo: (logo: File | null) => void
  readonly setResult: (result: ResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const usePdfAnnotateStore = create<PdfAnnotateState>()((set, get) => ({
  file: null,
  logo: null,
  logoUrl: null,
  result: null,
  setFile: (file) => {
    revoke(get().result?.url)
    set({ file, result: null })
  },
  setLogo: (logo) => {
    revoke(get().logoUrl)
    set({ logo, logoUrl: logo ? URL.createObjectURL(logo) : null })
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
    revoke(get().logoUrl)
    revoke(get().result?.url)
    set({ file: null, logo: null, logoUrl: null, result: null })
  },
}))
