import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { isPdfFile } from "@/features/pdf-tools/validation"
import { convertPdfToExcel } from "./process"
import { usePdfToExcelStore } from "./store"

export function usePdfToExcel() {
  const { file, result, setFile, setResult, reset } = usePdfToExcelStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const convert = useMutation({
    mutationFn: convertPdfToExcel,
    onSuccess: (output, selectedFile) => {
      if (usePdfToExcelStore.getState().file === selectedFile) setResult(output)
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return
    convert.reset()
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
    setSelectionError(null)
    reset()
  }

  return { file, result, selectionError, convert, selectFile, clear }
}
