import { create } from "zustand"

import type { PdfProtectionOutput, PdfProtectionResult } from "./types"

interface PdfProtectState {
  readonly file: File | null
  readonly result: PdfProtectionResult | null
  readonly setFile: (file: File | null) => void
  readonly setResult: (result: PdfProtectionOutput) => void
  readonly clearResult: () => void
  readonly reset: () => void
}

const revoke = (url: string | null | undefined) => {
  if (url) URL.revokeObjectURL(url)
}

export const usePdfProtectStore = create<PdfProtectState>()((set, get) => ({
  file: null,
  result: null,
  setFile: (file) => {
    revoke(get().result?.url)
    set({ file, result: null })
  },
  setResult: (result) => {
    revoke(get().result?.url)

    const url = result.blob ? URL.createObjectURL(result.blob) : result.url
    const metadata = {
      fileName: result.fileName,
      operation: result.operation,
      inputBytes: result.inputBytes,
      outputBytes: result.outputBytes,
    }

    set({ result: { ...metadata, url } })
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
