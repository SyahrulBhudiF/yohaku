import { useMutation } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { preparePdfFile } from "@/features/pdf-tools/process"
import { newPdfId, type PdfFileEntry } from "@/features/pdf-tools/store"
import { disposePdfFile } from "@/features/pdf-tools/thumbnails"
import { isPdfFile } from "@/features/pdf-tools/validation"
import { MAX_IMAGE_BYTES } from "@/libs/schemas/image"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { processPdfAnnotate, type PdfAnnotateInput } from "./process"
import { usePdfAnnotateStore } from "./store"

const isLogoFile = (file: File) =>
  file.type === "image/png" || file.type === "image/jpeg" || /\.(png|jpe?g)$/i.test(file.name)

export function usePdfAnnotate() {
  const { file, logo, logoUrl, result, setFile, setLogo, setResult, reset } = usePdfAnnotateStore()
  const [error, setError] = useState<string | null>(null)
  const pendingSelection = useRef<File | null>(null)
  const prepare = useMutation({
    mutationFn: async (selected: File) => {
      const id = newPdfId()
      const prepared = await preparePdfFile(id, selected)

      return { id, selected, prepared }
    },
    onSuccess: ({ id, selected, prepared }) => {
      if (pendingSelection.current !== selected) {
        disposePdfFile(id)

        return
      }

      if (!prepared.ok) {
        disposePdfFile(id)
        setError(
          prepared.reason === "password"
            ? "Password-protected PDFs are not supported here. Unlock the PDF first."
            : prepared.message,
        )

        return
      }

      const entry: PdfFileEntry = {
        id,
        file: selected,
        name: selected.name,
        size: selected.size,
        pageCount: prepared.pageCount,
      }

      pendingSelection.current = null
      setFile(entry)
      setError(null)
    },
    onError: () => {
      pendingSelection.current = null
      setError("Could not read this PDF.")
    },
  })
  const annotate = useMutation({
    mutationFn: processPdfAnnotate,
    onSuccess: (output, input) => {
      if (usePdfAnnotateStore.getState().file?.file === input.file) {
        setResult(output)
      }
    },
  })

  useEffect(
    () => () => {
      const current = usePdfAnnotateStore.getState()

      pendingSelection.current = null

      if (current.file) {
        disposePdfFile(current.file.id)
      }

      current.reset()
    },
    [],
  )

  const selectFile = (selected: File | undefined) => {
    if (!selected) {
      return
    }

    setError(null)
    pendingSelection.current = null
    prepare.reset()
    annotate.reset()

    if (!isPdfFile(selected)) {
      setError("Choose a PDF file.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_PDF_BYTES) {
      setError(
        selected.size === 0
          ? "This PDF is empty."
          : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      )

      return
    }

    if (file) {
      disposePdfFile(file.id)
      reset()
    }

    pendingSelection.current = selected
    prepare.mutate(selected)
  }

  const removeFile = () => {
    if (file) {
      disposePdfFile(file.id)
    }

    pendingSelection.current = null
    prepare.reset()
    annotate.reset()
    setError(null)
    reset()
  }

  const selectLogo = (selected: File | undefined) => {
    if (!selected) {
      return
    }

    annotate.reset()
    usePdfAnnotateStore.getState().clearResult()
    setError(null)

    if (!isLogoFile(selected)) {
      setError("Use a PNG or JPEG watermark image.")

      return
    }

    if (selected.size === 0 || selected.size > MAX_IMAGE_BYTES) {
      setError(`Watermark images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`)

      return
    }

    setLogo(selected)
  }

  const removeLogo = () => {
    annotate.reset()
    usePdfAnnotateStore.getState().clearResult()
    setLogo(null)
  }

  return {
    file,
    logo,
    logoUrl,
    result,
    error: error ?? annotate.error?.message ?? prepare.error?.message ?? null,
    isReading: prepare.isPending,
    isAnnotating: annotate.isPending,
    selectFile,
    removeFile,
    selectLogo,
    removeLogo,
    annotate,
    clearResult: () => {
      annotate.reset()
      usePdfAnnotateStore.getState().clearResult()
    },
    setError,
  }
}

export type { PdfAnnotateInput }
