import { useQuery } from "@tanstack/react-query"
import { FileTextIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/libs/utils/cn"
import { getPdfThumbnail } from "../thumbnails"

interface PageThumbnailProps {
  readonly fileId: string
  readonly file: File
  readonly pageNumber: number
  readonly password: string | undefined
  readonly rotation?: 0 | 90 | 180 | 270
}

export function PageThumbnail({
  fileId,
  file,
  pageNumber,
  password,
  rotation = 0,
}: PageThumbnailProps) {
  const container = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(
    () => typeof window !== "undefined" && typeof IntersectionObserver === "undefined",
  )

  // architecture: external synchronization (IntersectionObserver)
  useEffect(() => {
    const element = container.current

    if (!element) {
      return
    }

    if (typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          setVisible(true)
        }
      },
      { rootMargin: "240px" },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  const thumbnail = useQuery({
    queryKey: ["pdf-thumbnail", fileId, pageNumber, password ?? ""],
    queryFn: () => getPdfThumbnail(fileId, file, pageNumber, password),
    enabled: visible,
    staleTime: Infinity,
    retry: false,
  })

  return (
    <div ref={container} className="flex size-full items-center justify-center overflow-hidden">
      {thumbnail.data ? (
        <img
          src={thumbnail.data}
          alt={`Page ${pageNumber}`}
          draggable={false}
          decoding="async"
          className={cn(
            "size-full object-contain",
            rotation === 90 || rotation === 270 ? "scale-[0.7]" : "",
          )}
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      ) : thumbnail.isError || (thumbnail.isSuccess && !thumbnail.data) ? (
        <FileTextIcon className="size-8 text-outline" />
      ) : (
        <div className="size-full animate-pulse bg-surface-container-high" />
      )}
    </div>
  )
}
