import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { isPdfFile } from "@/features/pdf-tools/validation"
import type {
  PdfCompressionError,
  PdfInvalidFileError,
  PdfPasswordError,
} from "@/infrastructure/errors/pdf"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { compressPdfFile } from "./process"
import { useCompressPdfStore } from "./store"

export function useCompressPdf() {
  const { file, result, setFile, setResult, reset } = useCompressPdfStore()
  const [error, setError] = useState<string | null>(null)
  const compress = useMutation<
    Awaited<ReturnType<typeof compressPdfFile>>,
    PdfCompressionError | PdfInvalidFileError | PdfPasswordError,
    Parameters<typeof compressPdfFile>[0]
  >({
    mutationFn: compressPdfFile,
    onSuccess: (output, input) => {
      if (useCompressPdfStore.getState().file === input.file) {
        setError(null)
        setResult(output)
      }
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return
    compress.reset()
    setError(null)

    if (!isPdfFile(selected)) {
      setFile(null)
      setError("Choose a PDF file.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_PDF_BYTES) {
      setFile(null)

      setError(
        selected.size === 0
          ? "This PDF is empty."
          : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      )

      return
    }

    setFile(selected)
  }

  const clear = () => {
    compress.reset()
    setError(null)
    reset()
  }

  return {
    file,
    result,
    error,
    selectFile,
    clear,
    compress,
  }
}
