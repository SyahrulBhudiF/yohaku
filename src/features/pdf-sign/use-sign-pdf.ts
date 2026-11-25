import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { preparePdfFile } from "@/features/pdf-tools/process"
import { newPdfId } from "@/features/pdf-tools/store"
import { disposePdfFile, getPdfDocument } from "@/features/pdf-tools/thumbnails"
import { isPdfFile } from "@/features/pdf-tools/validation"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_IMAGE_BYTES } from "@/libs/schemas/image"
import { normalizeSignatureImage } from "@/libs/utils/pdf/signature-image"
import { signPdf } from "./process"
import { useSignStore, type PlacedSignature, type Signature } from "./store"

export function useSignPdf() {
  const state = useSignStore()
  const mounted = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const pageAspect = useQuery({
    queryKey: ["pdf-sign-page-aspect", state.file?.id ?? "none", state.page],
    queryFn: async () => {
      const file = useSignStore.getState().file

      if (!file) return null

      const { document } = await getPdfDocument(file.id, file.file)
      const page = await document.getPage(state.page)
      const viewport = page.getViewport({ scale: 1 })
      const aspect = viewport.width / viewport.height

      page.cleanup()

      return aspect
    },
    enabled: state.file !== null,
    staleTime: Infinity,
    retry: false,
  })
  const preview =
    pageAspect.data === undefined || pageAspect.data === null ? null : { aspect: pageAspect.data }
  const result = state.result?.revision === state.revision ? state.result : null

  const open = useMutation({
    mutationFn: async (source: File) => {
      if (!isPdfFile(source)) return { error: "Choose a PDF file." } as const
      const id = newPdfId()
      const prepared = await preparePdfFile(id, source)

      if (!prepared.ok) {
        disposePdfFile(id)

        return {
          error:
            prepared.reason === "password"
              ? "Password-protected PDFs are not supported for signing."
              : prepared.message,
        } as const
      }

      return {
        entry: {
          id,
          file: source,
          name: source.name,
          size: source.size,
          pageCount: prepared.pageCount,
        },
      } as const
    },
    onSuccess: (value) => {
      if (!mounted.current) {
        if ("entry" in value) disposePdfFile(value.entry.id)

        return
      }

      if ("error" in value) {
        setError(value.error)

        return
      }

      setError(null)
      useSignStore.getState().clearResult()
      useSignStore.setState((s) => ({
        file: value.entry,
        page: 1,
        placements: [],
        selected: null,
        revision: s.revision + 1,
      }))
    },
  })
  const exportPdf = useMutation({
    mutationFn: ({ source, items }: { source: File; items: PlacedSignature[]; revision: number }) =>
      signPdf(source, items),
    onSuccess: (blob, variables) => {
      if (!mounted.current || useSignStore.getState().revision !== variables.revision) return
      useSignStore.getState().setResult({ blob, revision: variables.revision })
    },
  })

  // architecture: external synchronization (route unmount cleanup)
  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      const current = useSignStore.getState()

      if (current.file) disposePdfFile(current.file.id)
      current.reset()
    }
  }, [])

  const edit = (placements: PlacedSignature[], selected: string | null) => {
    useSignStore.setState((s) => ({ placements, selected, revision: s.revision + 1 }))
    useSignStore.getState().clearResult()
    exportPdf.reset()
  }
  const addSignature = async (source: Blob) => {
    const fileId = state.file?.id

    if (source.size > MAX_IMAGE_BYTES) {
      setError("Signature images can be at most 25 MB.")

      return
    }

    try {
      const image = await runEffect(normalizeSignatureImage(source))
      const signature = { id: newPdfId(), ...image }

      if (!mounted.current || useSignStore.getState().file?.id !== fileId) return
      useSignStore.setState((s) => ({ signatures: [...s.signatures, signature] }))
      setError(null)
    } catch {
      setError("Could not read the signature image. Choose a valid PNG, JPEG, or WebP.")
    }
  }
  const place = (signature: Signature) => {
    if (!preview) return
    const width = Math.min(0.3, (0.3 * signature.aspect) / preview.aspect)
    const height = (width * preview.aspect) / signature.aspect
    const id = newPdfId()

    edit(
      [
        ...state.placements,
        {
          id,
          page: state.page,
          url: signature.url,
          png: signature.png,
          x: 0.35,
          y: 0.35,
          width,
          height,
        },
      ],
      id,
    )
  }
  const update = (id: string, changes: Partial<PlacedSignature>) =>
    edit(
      state.placements.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      id,
    )
  const resize = (item: PlacedSignature, width: number) => {
    const height = (item.height * width) / item.width

    update(item.id, {
      width,
      height,
      x: Math.min(item.x, 1 - width),
      y: Math.min(item.y, 1 - height),
    })
  }
  const removeFile = () => {
    if (state.file) disposePdfFile(state.file.id)
    useSignStore.setState((s) => ({
      file: null,
      placements: [],
      selected: null,
      revision: s.revision + 1,
    }))
    useSignStore.getState().clearResult()
    setError(null)
    exportPdf.reset()
  }

  return {
    ...state,
    error,
    preview,
    result,
    open,
    exportPdf,
    addSignature,
    place,
    update,
    resize,
    removeFile,
    select: (selected: string | null) => useSignStore.setState({ selected }),
    changePage: (page: number) => {
      useSignStore.setState({ page, selected: null })
    },
    removePlacement: (id: string) =>
      edit(
        state.placements.filter((item) => item.id !== id),
        null,
      ),
    createPdf: () => {
      if (state.file) {
        useSignStore.getState().clearResult()
        exportPdf.mutate({
          source: state.file.file,
          items: state.placements,
          revision: state.revision,
        })
      }
    },
  }
}
