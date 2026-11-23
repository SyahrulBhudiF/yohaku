import { create } from "zustand"

export interface ImageToolResult {
  readonly url: string
  readonly fileName: string
  readonly mimeType: string
  readonly originalBytes: number
  readonly resultBytes: number
}

interface ImageToolState {
  readonly file: File | null
  readonly previewUrl: string | null
  readonly result: ImageToolResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: { blob: Blob } & Omit<ImageToolResult, "url">) => void
  readonly clearResult: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

const createImageToolStore = () =>
  create<ImageToolState>()((set, get) => ({
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
  }))

export const useConvertStore = createImageToolStore()

export const useCompressStore = createImageToolStore()

export type ImageToolStore = typeof useConvertStore
