import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_VIDEO_GIF_INPUT_BYTES, type VideoGifFormValues } from "@/libs/schemas/video-gif"
import { convertVideoToGif } from "./process"
import { useVideoToGifStore } from "./store"
import { isVideoFile } from "./validation"

export function useVideoToGif() {
  const { file, result, setFile, setResult, clearResult, reset } = useVideoToGifStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const convert = useMutation({
    mutationFn: ({ selectedFile, options }: { selectedFile: File; options: VideoGifFormValues }) =>
      convertVideoToGif(selectedFile, options, setProgress),
    onMutate: () => setProgress(0),
    onSuccess: (output, input) => {
      if (useVideoToGifStore.getState().file === input.selectedFile) setResult(output)
    },
    onError: () => setProgress(0),
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return

    convert.reset()
    setProgress(0)
    setSelectionError(null)

    if (!isVideoFile(selected)) {
      setSelectionError("Choose a video file.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_VIDEO_GIF_INPUT_BYTES) {
      setSelectionError(
        selected.size === 0
          ? "This video file is empty."
          : `Video files can be at most ${MAX_VIDEO_GIF_INPUT_BYTES / 1024 / 1024} MB.`,
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

  return {
    file,
    result,
    selectionError,
    progress,
    convert,
    selectFile,
    clear,
    clearResult,
  }
}
