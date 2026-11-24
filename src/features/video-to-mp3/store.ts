import { create } from "zustand"

import type { VideoToMp3Output } from "./process"

export type VideoToMp3Result = Omit<VideoToMp3Output, "blob"> & { readonly url: string }

interface VideoToMp3State {
  readonly file: File | null
  readonly result: VideoToMp3Result | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: VideoToMp3Output) => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const useVideoToMp3Store = create<VideoToMp3State>()((set, get) => ({
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
