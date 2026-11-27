import { create } from "zustand"

import type { ImageOcrOutput } from "@/libs/schemas/image-ocr"

export type ImageOcrResult = ImageOcrOutput & {
  readonly url: string
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

interface ImageOcrState {
  readonly file: File | null
  readonly result: ImageOcrResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (output: ImageOcrOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useImageToTextStore = create<ImageOcrState>()((set, get) => ({
  file: null,
  result: null,
  setFile: (file) => {
    revoke(get().result?.url)
    set({ file, result: null })
  },
  setResult: (output) => {
    revoke(get().result?.url)
    const blob = new Blob([output.text], { type: "text/plain;charset=utf-8" })

    set({
      result: { ...output, url: URL.createObjectURL(blob) },
    })
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
