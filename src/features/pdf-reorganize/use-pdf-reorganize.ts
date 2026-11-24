import { useMutation } from "@tanstack/react-query"

import { usePdfReorganizeStore } from "./store"
import { reorganizePdfFile } from "./process"

export function usePdfReorganize() {
  const { file, pages, result, setFile, setPages, removePage, rotatePage, setResult, reset } =
    usePdfReorganizeStore()
  const reorganize = useMutation({
    mutationFn: reorganizePdfFile,
    onSuccess: (output, input) => {
      if (usePdfReorganizeStore.getState().file?.id === input.file.id) setResult(output)
    },
  })

  const clear = () => {
    reorganize.reset()
    reset()
  }

  return {
    file,
    pages,
    result,
    setFile,
    setPages,
    removePage,
    rotatePage,
    clear,
    reorganize,
  }
}
