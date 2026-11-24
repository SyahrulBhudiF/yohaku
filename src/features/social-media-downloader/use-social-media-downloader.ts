import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import {
  downloadSocialMediaEffect,
  resolveSocialMediaEffect,
  type DownloadProgress,
  type SocialMediaDownloadRequest,
} from "./process"

export function useSocialMediaDownloader() {
  const [progress, setProgress] = useState<DownloadProgress>({ phase: "download", progress: 0 })
  const resolve = useMutation({ mutationFn: resolveSocialMediaEffect })
  const download = useMutation({
    mutationFn: (request: SocialMediaDownloadRequest) =>
      downloadSocialMediaEffect(request, setProgress),
    onMutate: () => setProgress({ phase: "download", progress: 0 }),
  })

  const reset = () => {
    resolve.reset()
    download.reset()
    setProgress({ phase: "download", progress: 0 })
  }

  return { resolve, download, progress, reset }
}
