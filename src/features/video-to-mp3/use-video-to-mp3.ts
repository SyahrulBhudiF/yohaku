import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_VIDEO_BYTES } from "@/libs/schemas/video"
import { convertVideoToMp3 } from "./process"
import { useVideoToMp3Store } from "./store"
import { isMediaFile } from "./validation"

export function useVideoToMp3() {
  const { file, result, setFile, setResult, reset } = useVideoToMp3Store()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const convert = useMutation({
    mutationFn: (selected: File) => convertVideoToMp3(selected, setProgress),
    onMutate: () => setProgress(0),
    onSuccess: (output, selectedFile) => {
      if (useVideoToMp3Store.getState().file === selectedFile) setResult(output)
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return

    convert.reset()
    setProgress(0)
    setSelectionError(null)

    if (!isMediaFile(selected)) {
      setSelectionError("Choose a video or audio file.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_VIDEO_BYTES) {
      setSelectionError(
        selected.size === 0
          ? "This media file is empty."
          : `Video and audio files can be at most ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`,
      )

      return
    }

    setFile(selected)
  }

  const clear = () => {
    convert.reset()
    setSelectionError(null)
    setProgress(0)
    reset()
  }

  return { file, result, selectionError, progress, convert, selectFile, clear }
}
