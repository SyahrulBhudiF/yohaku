import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_IMAGE_OCR_BYTES, type ImageOcrProgress } from "@/libs/schemas/image-ocr"
import { convertImageToText } from "./process"
import { useImageToTextStore } from "./store"

export function useImageToText() {
  const { file, result, setFile, setResult, clearResult, reset } = useImageToTextStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ImageOcrProgress | null>(null)
  const convert = useMutation({
    mutationFn: convertImageToText,
    onSuccess: (output, input) => {
      if (useImageToTextStore.getState().file === input.file) setResult(output)

      setProgress(null)
    },
    onError: () => setProgress(null),
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return

    convert.reset()
    setProgress(null)
    setSelectionError(null)

    if (selected.size === 0) {
      setSelectionError("This image is empty.")

      return
    }

    if (selected.size > MAX_IMAGE_OCR_BYTES) {
      setSelectionError(`Images can be at most ${MAX_IMAGE_OCR_BYTES / 1024 / 1024} MB.`)

      return
    }

    if (selected.type && !selected.type.startsWith("image/")) {
      setSelectionError("Choose an image file to read.")

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
