import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_PPTX_BYTES } from "@/libs/schemas/powerpoint"
import { preloadPptxPdf } from "@/libs/utils/pptx-pdf"
import { processPowerPointToPdf } from "./process"
import { usePowerPointToPdfStore } from "./store"
import { isLegacyPptFile, isPptxFile } from "./validation"

export function usePowerPointToPdf() {
  const { file, result, setFile, setResult, reset } = usePowerPointToPdfStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const convert = useMutation({
    mutationFn: processPowerPointToPdf,
    onSuccess: (output, selectedFile) => {
      if (usePowerPointToPdfStore.getState().file === selectedFile) {
        setResult(output)
      }
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) {
      return
    }

    convert.reset()
    setSelectionError(null)

    if (isLegacyPptFile(selected)) {
      setSelectionError(
        "Legacy .ppt files are not supported. Save the deck as .pptx and try again.",
      )

      return
    }

    if (!isPptxFile(selected)) {
      setSelectionError("Choose a .pptx PowerPoint presentation.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_PPTX_BYTES) {
      setSelectionError(
        selected.size === 0
          ? "This presentation is empty."
          : `Presentations can be at most ${MAX_PPTX_BYTES / 1024 / 1024} MB.`,
      )

      return
    }

    setFile(selected)
    void preloadPptxPdf().catch(() => null)
  }

  const clear = () => {
    convert.reset()
    setSelectionError(null)
    reset()
  }

  return { file, result, selectionError, convert, selectFile, clear }
}
