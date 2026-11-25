import { create } from "zustand"

interface SocialMediaDownloaderState {
  readonly resultUrl: string | null
  readonly setResultUrl: (blob: Blob) => void
  readonly clearResult: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

export const useSocialMediaDownloaderStore = create<SocialMediaDownloaderState>()((set, get) => ({
  resultUrl: null,
  setResultUrl: (blob) => {
    revoke(get().resultUrl)
    set({ resultUrl: URL.createObjectURL(blob) })
  },
  clearResult: () => {
    revoke(get().resultUrl)
    set({ resultUrl: null })
  },
}))
