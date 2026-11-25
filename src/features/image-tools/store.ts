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

export interface ImagePdfFileEntry {
  readonly id: string
  readonly file: File
  readonly name: string
  readonly size: number
  readonly previewUrl: string
}

export interface ImagePdfResult {
  readonly url: string
  readonly fileName: string
  readonly bytes: number
  readonly inputBytes: number
  readonly images: number
  readonly pdfs: number
}

type ImagePdfResultInput = Omit<ImagePdfResult, "url"> & { readonly blob: Blob }

export const newImageId = () => globalThis.crypto.randomUUID()

interface ImagePdfState {
  readonly files: Array<ImagePdfFileEntry>
  readonly result: ImagePdfResult | null
  readonly addFiles: (files: ReadonlyArray<File>) => void
  readonly removeFile: (id: string) => void
  readonly setFiles: (files: ReadonlyArray<ImagePdfFileEntry>) => void
  readonly setResult: (result: ImagePdfResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

export const useImageToPdfStore = create<ImagePdfState>()((set, get) => ({
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

export interface ImageResult {
  readonly url: string
  readonly fileName: string
  readonly mimeType: string
  readonly bytes: number
  readonly inputBytes: number
  readonly width: number
  readonly height: number
}

type ImageResultInput = Omit<ImageResult, "url"> & { readonly blob: Blob }

interface ImageResultState {
  readonly file: File | null
  readonly previewUrl: string | null
  readonly result: ImageResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: ImageResultInput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

const createImageResultStore = () =>
  create<ImageResultState>()((set, get) => ({
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
    reset: () => {
      revoke(get().previewUrl)
      revoke(get().result?.url)
      set({ file: null, previewUrl: null, result: null })
    },
  }))

export const useRemoveBackgroundStore = createImageResultStore()

export const useResizeStore = createImageResultStore()
