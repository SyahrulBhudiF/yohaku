import { create } from "zustand"

import type { WatermarkOutput } from "@/libs/schemas/watermark"

export type WatermarkResult = Omit<WatermarkOutput, "blob"> & { readonly url: string }

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

interface WatermarkState {
  readonly file: File | null
  readonly previewUrl: string | null
  readonly logo: File | null
  readonly logoPreviewUrl: string | null
  readonly result: WatermarkResult | null
  readonly setFile: (file: File | null) => void
  readonly setLogo: (file: File | null) => void
  readonly setResult: (output: WatermarkOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useWatermarkStore = create<WatermarkState>()((set, get) => ({
  file: null,
  previewUrl: null,
  logo: null,
  logoPreviewUrl: null,
  result: null,
  setFile: (file) => {
    revoke(get().previewUrl)
    revoke(get().result?.url)
    set({ file, previewUrl: file ? URL.createObjectURL(file) : null, result: null })
  },
  setLogo: (file) => {
    revoke(get().logoPreviewUrl)
    revoke(get().result?.url)
    set({ logo: file, logoPreviewUrl: file ? URL.createObjectURL(file) : null, result: null })
  },
  setResult: ({ blob, ...output }) => {
    revoke(get().result?.url)
    set({ result: { ...output, url: URL.createObjectURL(blob) } })
  },
  clearResult: () => {
    revoke(get().result?.url)
    set({ result: null })
  },
  reset: () => {
    revoke(get().previewUrl)
    revoke(get().logoPreviewUrl)
    revoke(get().result?.url)
    set({ file: null, previewUrl: null, logo: null, logoPreviewUrl: null, result: null })
  },
}))
