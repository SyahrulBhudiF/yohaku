import { create } from "zustand"

import type { BatchCompressOutput, BatchImageInputFile } from "@/libs/schemas/image"
import { newImageId } from "./store"

export type BatchImageEntry = BatchImageInputFile & { readonly previewUrl: string }

export type BatchCompressResult = Omit<BatchCompressOutput, "blob"> & { readonly url: string }

type ResultInput = BatchCompressOutput

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

interface BatchCompressState {
  readonly files: Array<BatchImageEntry>
  readonly result: BatchCompressResult | null
  readonly addFiles: (files: ReadonlyArray<File>) => void
  readonly removeFile: (id: string) => void
  readonly setFiles: (files: ReadonlyArray<BatchImageEntry>) => void
  readonly setResult: (result: ResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useBatchCompressStore = create<BatchCompressState>()((set, get) => ({
  files: [],
  result: null,
  addFiles: (incoming) => {
    revoke(get().result?.url)

    const entries = incoming.map((file) => ({
      id: newImageId(),
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }))

    set({ files: [...get().files, ...entries], result: null })
  },
  removeFile: (id) => {
    const entry = get().files.find((file) => file.id === id)

    if (entry) {
      revoke(entry.previewUrl)
    }

    revoke(get().result?.url)
    set({ files: get().files.filter((file) => file.id !== id), result: null })
  },
  setFiles: (files) => {
    revoke(get().result?.url)
    set({ files: [...files], result: null })
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
    for (const entry of get().files) {
      revoke(entry.previewUrl)
    }

    revoke(get().result?.url)
    set({ files: [], result: null })
  },
}))
