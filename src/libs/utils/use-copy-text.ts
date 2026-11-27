import { useState } from "react"

type CopyStatus = "idle" | "copied" | "failed"

export function useCopyText() {
  const [status, setStatus] = useState<CopyStatus>("idle")

  const copy = (text: string) => {
    setStatus("idle")

    if (!navigator.clipboard) {
      setStatus("failed")

      return
    }

    void navigator.clipboard.writeText(text).then(
      () => setStatus("copied"),
      () => setStatus("failed"),
    )
  }

  const reset = () => setStatus("idle")

  return { status, copy, reset }
}
