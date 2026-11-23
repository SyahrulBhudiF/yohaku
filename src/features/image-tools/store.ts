import { create } from "zustand"

import { processImage, type ImageToolMode } from "./api"
import { IMAGE_FORMATS, type ImageFormat } from "@/libs/schemas/image"

export type FormatChoice = ImageFormat | "original"

export interface ImageToolResult {
  readonly url: string
  readonly fileName: string
  readonly originalBytes: number
  readonly resultBytes: number
}

interface ImageToolState {
  readonly file: File | null
  readonly previewUrl: string | null
  readonly format: FormatChoice
  readonly quality: number
  readonly status: "idle" | "processing" | "done" | "error"
  readonly error: string | null
  readonly result: ImageToolResult | null
  readonly setFile: (file: File | null) => void
  readonly setFormat: (format: FormatChoice) => void
  readonly setQuality: (quality: number) => void
  readonly run: () => Promise<void>
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

export const isImageFormat = (value: string): value is ImageFormat =>
  IMAGE_FORMATS.some((format) => format === value)

const createImageToolStore = (mode: ImageToolMode) =>
  create<ImageToolState>()((set, get) => ({
    file: null,
    previewUrl: null,
    format: mode === "convert" ? "webp" : "original",
    quality: 80,
    status: "idle",
    error: null,
    result: null,
    setFile: (file) => {
      revoke(get().previewUrl)
      revoke(get().result?.url)
      set({
        file,
        previewUrl: file ? URL.createObjectURL(file) : null,
        status: "idle",
        error: null,
        result: null,
      })
    },
    setFormat: (format) => set({ format, status: "idle", result: null }),
    setQuality: (quality) => set({ quality, status: "idle", result: null }),
    run: async () => {
      const { file, format, quality } = get()

      if (!file) {
        return
      }

      revoke(get().result?.url)
      set({ status: "processing", error: null, result: null })

      try {
        const output = await processImage({
          mode,
          file,
          format: format === "original" ? undefined : format,
          quality,
        })

        set({
          status: "done",
          result: {
            url: URL.createObjectURL(output.blob),
            fileName: output.fileName,
            originalBytes: output.originalBytes,
            resultBytes: output.resultBytes,
          },
        })
      } catch (error) {
        set({
          status: "error",
          error: error instanceof Error ? error.message : "Something went wrong.",
        })
      }
    },
    reset: () => get().setFile(null),
  }))

export const useConvertStore = createImageToolStore("convert")

export const useCompressStore = createImageToolStore("compress")
