import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { usePdfProtectStore } from "./store"
import { protectPdfFile, unlockPdfFile } from "./process"

export type PdfProtectionMode = "protect" | "unlock"

export function usePdfProtect() {
  const { file, result, setFile, setResult, reset, clearResult } = usePdfProtectStore()
  const [mode, setMode] = useState<PdfProtectionMode>("protect")
  const protect = useMutation({
    mutationFn: protectPdfFile,
    onSuccess: (output, input) => {
      if (usePdfProtectStore.getState().file === input.file) {
        setResult(output)
      } else if (output.url) {
        URL.revokeObjectURL(output.url)
      }
    },
  })
  const unlock = useMutation({
    mutationFn: unlockPdfFile,
    onSuccess: (output, input) => {
      if (usePdfProtectStore.getState().file === input.file) {
        setResult(output)
      } else if (output.url) {
        URL.revokeObjectURL(output.url)
      }
    },
  })

  const selectMode = (nextMode: PdfProtectionMode) => {
    protect.reset()
    unlock.reset()
    clearResult()
    setMode(nextMode)
  }

  const clear = () => {
    protect.reset()
    unlock.reset()
    reset()
  }

  return { file, result, mode, setFile, selectMode, clear, protect, unlock }
}
