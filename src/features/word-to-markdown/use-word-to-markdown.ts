import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_DOCX_BYTES } from "@/libs/schemas/document"
import { convertWordToMarkdown } from "./process"
import { useWordToMarkdownStore } from "./store"

export function useWordToMarkdown() {
  const { file, result, setFile, setResult, reset } = useWordToMarkdownStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const convert = useMutation({
    mutationFn: convertWordToMarkdown,
    onSuccess: (output, selectedFile) => {
      if (useWordToMarkdownStore.getState().file === selectedFile) setResult(output)
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return
    convert.reset()
    setSelectionError(null)

    if (!selected.name.toLowerCase().endsWith(".docx")) {
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
