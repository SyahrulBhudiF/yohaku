import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_DOCX_BYTES } from "@/libs/schemas/document"
import { convertWordToPdf } from "./process"
import { useWordToPdfStore } from "./store"

const isDocxFile = (file: File) =>
  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  file.name.toLowerCase().endsWith(".docx")

export function useWordToPdf() {
  const { file, result, setFile, setResult, reset } = useWordToPdfStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const convert = useMutation({
    mutationFn: convertWordToPdf,
    onSuccess: (output, selectedFile) => {
      if (useWordToPdfStore.getState().file === selectedFile) setResult(output)
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return
    convert.reset()
    setSelectionError(null)

    if (!isDocxFile(selected)) {
      setSelectionError("Choose a .docx Word document.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_DOCX_BYTES) {
      setSelectionError(
        selected.size === 0
          ? "This Word document is empty."
          : `Word documents can be at most ${MAX_DOCX_BYTES / 1024 / 1024} MB.`,
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
