import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { createImagePreview } from "./process"

const fileIds = new WeakMap<File, number>()
let nextFileId = 0

const getFileId = (file: File | null) => {
  if (!file) return null

  let id = fileIds.get(file)

  if (!id) {
    nextFileId += 1
    id = nextFileId
    fileIds.set(file, id)
  }

  return id
}

const isHeicFile = (file: File | null) =>
  file !== null &&
  (file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name))

export const useImagePreview = (file: File | null, fallbackUrl: string | null) => {
  const heic = isHeicFile(file)
  const preview = useQuery({
    queryKey: ["heic-preview", getFileId(file)],
    queryFn: async () => {
      if (!file) return null

      const blob = await createImagePreview(file)

      return blob ? URL.createObjectURL(blob) : null
    },
    enabled: heic,
    staleTime: Infinity,
    gcTime: 0,
  })

  // architecture: external synchronization
  useEffect(() => {
    const url = preview.data

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [preview.data])

  return {
    url: heic ? (preview.data ?? null) : fallbackUrl,
    isPending: heic && preview.isPending,
    error: heic ? preview.error : null,
  }
}
