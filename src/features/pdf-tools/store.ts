import { create } from "zustand"

import { disposeAllPdfFiles, disposePdfFile } from "./thumbnails"

export interface PdfFileEntry {
  readonly id: string
  readonly file: File
  readonly name: string
  readonly size: number
  readonly pageCount: number
  readonly password?: string
}

export interface PdfPageEntry {
  readonly id: string
  readonly fileId: string
  readonly pageNumber: number
}

export interface PdfResult {
  readonly url: string
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly pages: number
  readonly outputs?: number
}

type PdfResultInput = Omit<PdfResult, "url"> & { readonly blob: Blob }

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

export const newPdfId = () => globalThis.crypto.randomUUID()

interface MergeState {
  readonly files: Array<PdfFileEntry>
  readonly pages: Array<PdfPageEntry>
  readonly result: PdfResult | null
  readonly addFiles: (files: ReadonlyArray<PdfFileEntry>) => void
  readonly removeFile: (fileId: string) => void
  readonly removePage: (pageId: string) => void
  readonly setPages: (pages: ReadonlyArray<PdfPageEntry>) => void
  readonly setResult: (result: PdfResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useMergeStore = create<MergeState>()((set, get) => ({
  files: [],
  pages: [],
  result: null,
  addFiles: (incoming) => {
    revoke(get().result?.url)

    const files = [...get().files]
    const pages = [...get().pages]

    for (const entry of incoming) {
      files.push(entry)

      for (let pageNumber = 1; pageNumber <= entry.pageCount; pageNumber++) {
        pages.push({ id: `${entry.id}:${pageNumber}`, fileId: entry.id, pageNumber })
      }
    }

    set({ files, pages, result: null })
  },
  removeFile: (fileId) => {
    disposePdfFile(fileId)
    revoke(get().result?.url)

    const pages = get().pages.filter((page) => page.fileId !== fileId)
    const files = get().files.filter((file) => file.id !== fileId)

    set({ files, pages, result: null })
  },
  removePage: (pageId) => {
    revoke(get().result?.url)

    const removed = get().pages.find((page) => page.id === pageId)
    const pages = get().pages.filter((page) => page.id !== pageId)

    if (removed && !pages.some((page) => page.fileId === removed.fileId)) {
      disposePdfFile(removed.fileId)
      set({
        files: get().files.filter((file) => file.id !== removed.fileId),
        pages,
        result: null,
      })

      return
    }

    set({ pages, result: null })
  },
  setPages: (pages) => {
    revoke(get().result?.url)
    set({ pages: [...pages], result: null })
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
    disposeAllPdfFiles()
    revoke(get().result?.url)
    set({ files: [], pages: [], result: null })
  },
}))

interface SplitState {
  readonly file: PdfFileEntry | null
  readonly result: PdfResult | null
  readonly setFile: (file: PdfFileEntry | null) => void
  readonly setResult: (result: PdfResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useSplitStore = create<SplitState>()((set, get) => ({
  file: null,
  result: null,
  setFile: (file) => {
    const previous = get().file

    if (previous && previous.id !== file?.id) {
      disposePdfFile(previous.id)
    }

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
    const file = get().file

    if (file) {
      disposePdfFile(file.id)
    }

    revoke(get().result?.url)
    set({ file: null, result: null })
  },
}))

export interface PdfImageResult {
  readonly url: string
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly images: number
  readonly previewUrl?: string
  readonly previewMimeType?: string
}

type PdfImageResultInput = Omit<PdfImageResult, "url" | "previewUrl" | "previewMimeType"> & {
  readonly blob: Blob
  readonly preview?: { readonly blob: Blob; readonly mimeType: string } | null
}

interface PdfToImageState {
  readonly file: PdfFileEntry | null
  readonly result: PdfImageResult | null
  readonly setFile: (file: PdfFileEntry | null) => void
  readonly setResult: (result: PdfImageResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const usePdfToImageStore = create<PdfToImageState>()((set, get) => ({
  file: null,
  result: null,
  setFile: (file) => {
    const previous = get().file

    if (previous && previous.id !== file?.id) {
      disposePdfFile(previous.id)
    }

    revoke(get().result?.url)
    revoke(get().result?.previewUrl)
    set({ file, result: null })
  },
  setResult: ({ blob, preview, ...result }) => {
    const previous = get().result

    revoke(previous?.url)
    revoke(previous?.previewUrl)
    set({
      result: {
        ...result,
        url: URL.createObjectURL(blob),
        ...(preview
          ? { previewUrl: URL.createObjectURL(preview.blob), previewMimeType: preview.mimeType }
          : {}),
      },
    })
  },
  clearResult: () => {
    revoke(get().result?.url)
    revoke(get().result?.previewUrl)
    set({ result: null })
  },
  reset: () => {
    const file = get().file

    if (file) {
      disposePdfFile(file.id)
    }

    revoke(get().result?.url)
    revoke(get().result?.previewUrl)
    set({ file: null, result: null })
  },
}))
