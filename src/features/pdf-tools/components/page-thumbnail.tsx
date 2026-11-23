import { FileTextIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { getPdfThumbnail } from "../thumbnails"

interface PageThumbnailProps {
  readonly fileId: string
  readonly file: File
  readonly pageNumber: number
  readonly password: string | undefined
}

type ThumbnailState = "idle" | "loading" | "ready" | "error"

export function PageThumbnail({ fileId, file, pageNumber, password }: PageThumbnailProps) {
  const container = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<ThumbnailState>("idle")

  useEffect(() => {
    const element = container.current

    if (!element) {
      return
    }

    let cancelled = false

    const render = () => {
      setState("loading")
      getPdfThumbnail(fileId, file, pageNumber, password)
        .then((value) => {
          if (!cancelled) {
            setUrl(value)
            setState(value ? "ready" : "error")
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState("error")
          }
        })
    }

    if (typeof IntersectionObserver === "undefined") {
      render()

      return () => {
        cancelled = true
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          render()
        }
      },
      { rootMargin: "240px" },
    )

    observer.observe(element)

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [fileId, file, pageNumber, password])

  return (
    <div ref={container} className="flex size-full items-center justify-center overflow-hidden">
      {state === "ready" && url ? (
        <img
          src={url}
          alt={`Page ${pageNumber}`}
          draggable={false}
          decoding="async"
          className="size-full object-contain"
        />
      ) : state === "error" ? (
        <FileTextIcon className="size-8 text-outline" />
      ) : (
        <div className="size-full animate-pulse bg-surface-container-high" />
      )}
    </div>
  )
}
