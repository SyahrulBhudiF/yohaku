import { create } from "zustand"

import type { FaviconOutput } from "@/libs/schemas/favicon"

export type FaviconResult = Omit<FaviconOutput, "blob" | "preview"> & {
  readonly url: string
  readonly previewUrl: string
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

interface FaviconState {
  readonly file: File | null
  readonly previewUrl: string | null
  readonly result: FaviconResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (output: FaviconOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useFaviconStore = create<FaviconState>()((set, get) => ({
  file: null,
  previewUrl: null,
  result: null,
  setFile: (file) => {
    revoke(get().previewUrl)
    revoke(get().result?.url)
    revoke(get().result?.previewUrl)
    set({ file, previewUrl: file ? URL.createObjectURL(file) : null, result: null })
  },
  setResult: ({ blob, preview, ...output }) => {
    revoke(get().result?.url)
    revoke(get().result?.previewUrl)
    set({
      result: {
        ...output,
        url: URL.createObjectURL(blob),
        previewUrl: URL.createObjectURL(preview),
      },
    })
  },
  clearResult: () => {
    revoke(get().result?.url)
    revoke(get().result?.previewUrl)
    set({ result: null })
  },
  reset: () => {
    revoke(get().previewUrl)
    revoke(get().result?.url)
    revoke(get().result?.previewUrl)
    set({ file: null, previewUrl: null, result: null })
  },
}))
