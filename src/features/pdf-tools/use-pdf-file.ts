import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { preparePdfFile } from "./process"
import { newPdfId, type PdfFileEntry } from "./store"
import { disposePdfFile } from "./thumbnails"
import { isPdfFile } from "./validation"

export interface PendingPdfPassword {
  readonly id: string
  readonly file: File
  readonly message: string
}

interface PreparePdfInput {
  readonly id: string
  readonly file: File
  readonly password?: string
}

interface UsePdfFileOptions {
  readonly setFile: (file: PdfFileEntry) => void
  readonly reset: () => void
  readonly invalidMessage: string
  readonly onReset?: () => void
  readonly onSelected?: (file: PdfFileEntry) => void
}

/**
 * Owns PDF selection, password unlocking, and cleanup for a single-file tool.
 * Views call `select`/`unlock`/`remove`; they never read the file themselves.
 */
export function usePdfFile({
  setFile,
  reset,
  invalidMessage,
  onReset,
  onSelected,
}: UsePdfFileOptions) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPdfPassword | null>(null)
  const prepare = useMutation({
    mutationFn: ({ id, file, password }: PreparePdfInput) => preparePdfFile(id, file, password),
  })

  const remove = () => {
    prepare.reset()
    setError(null)

    if (pending) {
      disposePdfFile(pending.id)
    }

    setPending(null)
    reset()
    onReset?.()
  }

  const accept = async (id: string, file: File, password?: string) => {
    const prepared = await prepare.mutateAsync({
      id,
      file,
      ...(password === undefined ? {} : { password }),
    })

    if (!prepared.ok) {
      if (prepared.reason === "password") {
        setPending({ id, file, message: prepared.message })
      } else {
        disposePdfFile(id)
        setPending(null)
        setError(prepared.message)
      }

      return
    }

    const entry: PdfFileEntry = {
      id,
      file,
      name: file.name,
      size: file.size,
      pageCount: prepared.pageCount,
      ...(password ? { password } : {}),
    }

    setPending(null)
    setFile(entry)
    onSelected?.(entry)
  }

  const select = async (incoming: ReadonlyArray<File>) => {
    const next = incoming[0]

    if (!next) return

    remove()

    if (!isPdfFile(next)) {
      setError(invalidMessage)

      return
    }

    if (next.size === 0) {
      setError("This PDF is empty.")

      return
    }

    if (next.size > MAX_PDF_BYTES) {
      setError(`PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`)

      return
    }

    const id = newPdfId()

    try {
      await accept(id, next)
    } catch {
      disposePdfFile(id)
      setError("Could not read this PDF.")
    }
  }

  const unlock = async (password: string) => {
    if (!pending) return

    setError(null)

    try {
      await accept(pending.id, pending.file, password)
    } catch {
      setError("Could not unlock this PDF.")
    }
  }

  return {
    error: error ?? prepare.error?.message ?? null,
    setError,
    pending,
    select,
    unlock,
    remove,
    isReading: prepare.isPending && pending === null,
    isUnlocking: prepare.isPending && pending !== null,
  }
}
