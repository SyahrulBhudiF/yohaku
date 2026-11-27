import { create } from "zustand"

import type { ImageResult } from "./store"

interface SvgToImageState {
  readonly file: File | null
  readonly previewUrl: string | null
  readonly result: ImageResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: { blob: Blob } & Omit<ImageResult, "url">) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const useSvgToImageStore = create<SvgToImageState>()((set, get) => ({
  file: null,
  previewUrl: null,
  result: null,
  setFile: (file) => {
    revoke(get().previewUrl)
    revoke(get().result?.url)
    set({ file, previewUrl: file ? URL.createObjectURL(file) : null, result: null })
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
    revoke(get().previewUrl)
    revoke(get().result?.url)
    set({ file: null, previewUrl: null, result: null })
  },
}))
