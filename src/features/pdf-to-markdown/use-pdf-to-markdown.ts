import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { isPdfFile } from "@/features/pdf-tools/validation"
import { MAX_PDF_BYTES, type PdfOcrProgress } from "@/libs/schemas/pdf"
import { convertPdfToMarkdown } from "./process"
import { usePdfToMarkdownStore } from "./store"

export function usePdfToMarkdown() {
  const { file, result, setFile, setResult, clearResult, reset } = usePdfToMarkdownStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [progress, setProgress] = useState<PdfOcrProgress | null>(null)
  const convert = useMutation({
    mutationFn: convertPdfToMarkdown,
    onSuccess: (output, input) => {
      if (usePdfToMarkdownStore.getState().file === input.file) setResult(output)
      setProgress(null)
    },
    onError: () => setProgress(null),
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return
    convert.reset()
    setProgress(null)
    setSelectionError(null)

    if (!isPdfFile(selected)) {
      setSelectionError("Choose a PDF file.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_PDF_BYTES) {
      setSelectionError(
        selected.size === 0
          ? "This PDF is empty."
          : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      )

      return
    }

    setFile(selected)
  }

  const clear = () => {
    convert.reset()
    setProgress(null)
    setSelectionError(null)
    reset()
  }

  return {
    file,
    result,
    selectionError,
    progress,
    setProgress,
    convert,
    selectFile,
    clear,
    clearResult,
  }
}
