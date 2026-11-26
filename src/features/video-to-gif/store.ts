import { create } from "zustand"

import type { VideoToGifOutput } from "@/libs/schemas/video-gif"

export type VideoToGifResult = Omit<VideoToGifOutput, "blob"> & { readonly url: string }

interface VideoToGifState {
  readonly file: File | null
  readonly result: VideoToGifResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: VideoToGifOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const useVideoToGifStore = create<VideoToGifState>()((set, get) => ({
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
