import { create } from "zustand"

import type { MetadataCleanerOutput } from "@/libs/schemas/image-metadata"

export type MetadataCleanerResult = Omit<MetadataCleanerOutput, "blob"> & {
  readonly url: string
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

interface MetadataCleanerState {
  readonly file: File | null
  readonly previewUrl: string | null
  readonly result: MetadataCleanerResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (output: MetadataCleanerOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useMetadataCleanerStore = create<MetadataCleanerState>()((set, get) => ({
  file: null,
  previewUrl: null,
  result: null,
  setFile: (file) => {
    revoke(get().previewUrl)
    revoke(get().result?.url)
    set({ file, previewUrl: file ? URL.createObjectURL(file) : null, result: null })
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
    revoke(get().result?.url)
    set({ file: null, previewUrl: null, result: null })
  },
}))
