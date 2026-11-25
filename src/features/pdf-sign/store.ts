import { create } from "zustand"

import type { PdfFileEntry } from "@/features/pdf-tools/store"
import type { SignaturePlacement } from "./process"

export interface Signature {
  id: string
  url: string
  png: Uint8Array
  aspect: number
}

export interface PlacedSignature extends SignaturePlacement {
  id: string
  url: string
}

export interface SignResult {
  readonly url: string
  readonly bytes: number
  readonly revision: number
}

interface SignState {
  file: PdfFileEntry | null
  page: number
  signatures: Signature[]
  placements: PlacedSignature[]
  selected: string | null
  revision: number
  result: SignResult | null
  setResult: (result: { readonly blob: Blob; readonly revision: number }) => void
  clearResult: () => void
  reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

export const useSignStore = create<SignState>()((set, get) => ({
  file: null,
  page: 1,
  signatures: [],
  placements: [],
  selected: null,
  revision: 0,
  result: null,
  setResult: ({ blob, revision }) => {
    revoke(get().result?.url)
    set({ result: { url: URL.createObjectURL(blob), bytes: blob.size, revision } })
  },
  clearResult: () => {
    revoke(get().result?.url)
    set({ result: null })
  },
  reset: () => {
    revoke(get().result?.url)
    set((state) => ({
      file: null,
      page: 1,
      signatures: [],
      placements: [],
      selected: null,
      revision: state.revision + 1,
      result: null,
    }))
  },
}))
