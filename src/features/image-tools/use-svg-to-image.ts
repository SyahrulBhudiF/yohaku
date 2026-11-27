import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_SVG_BYTES } from "@/libs/schemas/svg-to-image"
import { convertSvgToImage, type ConvertSvgToImageInput } from "./svg-to-image-process"
import { useSvgToImageStore } from "./svg-to-image-store"

const isSvgFile = (file: File) =>
  file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml"

export function useSvgToImage() {
  const { file, previewUrl, result, setFile, setResult, clearResult, reset } = useSvgToImageStore()
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const convert = useMutation({
    mutationFn: (input: ConvertSvgToImageInput) => convertSvgToImage(input),
    onSuccess: (output, input) => {
      if (useSvgToImageStore.getState().file === input.file) {
        setResult({
          blob: output.blob,
          fileName: output.fileName,
          mimeType: output.mimeType,
          bytes: output.bytes,
          inputBytes: output.inputBytes,
          width: output.width,
          height: output.height,
        })
      }
    },
  })

  const selectFile = (selected: File | undefined) => {
    if (!selected) return

    convert.reset()
    setSelectionError(null)

    if (selected.size === 0) {
      setSelectionError("This file is empty.")

      return
    }

    if (selected.size > MAX_SVG_BYTES) {
      setSelectionError(`SVG files can be at most ${MAX_SVG_BYTES / 1024 / 1024} MB.`)

      return
    }

    if (!isSvgFile(selected)) {
      setSelectionError("Choose an SVG file.")

      return
    }

    setFile(selected)
  }

  const clear = () => {
    convert.reset()
    setSelectionError(null)
    reset()
  }

  return {
    file,
    previewUrl,
    result,
    selectionError,
    convert,
    selectFile,
    clear,
    clearResult,
  }
}
