import { create } from "zustand"

import type { PdfFileEntry, PdfPageEntry, PdfResult } from "@/features/pdf-tools/store"
import { disposePdfFile } from "@/features/pdf-tools/thumbnails"

type PdfResultInput = Omit<PdfResult, "url"> & { readonly blob: Blob }

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

interface PdfReorganizeState {
  readonly file: PdfFileEntry | null
  readonly pages: ReadonlyArray<PdfPageEntry>
  readonly result: PdfResult | null
  readonly setFile: (file: PdfFileEntry | null) => void
  readonly setPages: (pages: ReadonlyArray<PdfPageEntry>) => void
  readonly removePage: (pageId: string) => void
  readonly rotatePage: (pageId: string) => void
  readonly setResult: (result: PdfResultInput) => void
  readonly reset: () => void
}

export const usePdfReorganizeStore = create<PdfReorganizeState>()((set, get) => ({
  file: null,
  pages: [],
  result: null,
  setFile: (file) => {
    const previous = get().file

    if (previous && previous.id !== file?.id) disposePdfFile(previous.id)
    revoke(get().result?.url)
    set({
      file,
      pages: file
        ? Array.from({ length: file.pageCount }, (_, index) => ({
            id: `${file.id}:${index + 1}`,
            fileId: file.id,
            pageNumber: index + 1,
            rotation: 0 as const,
          }))
        : [],
      result: null,
    })
  },
  setPages: (pages) => {
    revoke(get().result?.url)
    set({ pages: [...pages], result: null })
  },
  removePage: (pageId) => {
    if (get().pages.length <= 1) return
    revoke(get().result?.url)
    set({ pages: get().pages.filter((page) => page.id !== pageId), result: null })
  },
  rotatePage: (pageId) => {
    revoke(get().result?.url)
    set({
      pages: get().pages.map((page) =>
        page.id === pageId
          ? { ...page, rotation: (((page.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270 }
          : page,
      ),
      result: null,
    })
  },
  setResult: ({ blob, ...result }) => {
    revoke(get().result?.url)
    set({ result: { ...result, url: URL.createObjectURL(blob) } })
  },
  reset: () => {
    const file = get().file

    if (file) disposePdfFile(file.id)
    revoke(get().result?.url)
    set({ file: null, pages: [], result: null })
  },
}))
