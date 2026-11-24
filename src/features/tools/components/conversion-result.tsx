import { DownloadIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { formatBytes } from "@/libs/utils/format"

interface ConversionResultProps {
  readonly url: string
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly detail?: string
  readonly children?: ReactNode
}

export function ConversionResult({
  url,
  fileName,
  inputBytes,
  outputBytes,
  detail,
  children,
}: ConversionResultProps) {
  return (
    <section
      aria-label="Conversion result"
      className="rounded-xl bg-tertiary-container p-4 text-on-tertiary-container"
    >
      <p className="font-medium">Your file is ready</p>
      <p className="mt-1 text-sm">
        {formatBytes(inputBytes)} → {formatBytes(outputBytes)}
        {detail ? ` · ${detail}` : ""}
      </p>
      {children}
      <Button
        className="mt-3"
        render={<a href={url} download={fileName} aria-label={`Download ${fileName}`} />}
        nativeButton={false}
      >
        <DownloadIcon />
        Download {fileName}
      </Button>
    </section>
  )
}
