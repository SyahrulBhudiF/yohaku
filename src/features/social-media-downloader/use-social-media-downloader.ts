import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import {
  downloadSocialMediaEffect,
  resolveSocialMediaEffect,
  type BrowserFileHandle,
  type DownloadProgress,
  type ResolvedSocialMedia,
  type SocialMediaDownloadRequest,
} from "./process"
import { useSocialMediaDownloaderStore } from "./store"
import { mediaFileStem, videoExtension } from "./validation"

type SaveTargetResult =
  | { readonly kind: "handle"; readonly handle: BrowserFileHandle }
  | { readonly kind: "browser-download" }
  | { readonly kind: "cancelled" }

declare global {
  interface Window {
    showSaveFilePicker?: (options: { readonly suggestedName: string }) => Promise<BrowserFileHandle>
  }
}

const chooseSaveTarget = async (fileName: string): Promise<SaveTargetResult> => {
  if (!window.showSaveFilePicker) return { kind: "browser-download" }

  try {
    return {
      kind: "handle",
      handle: await window.showSaveFilePicker({ suggestedName: fileName }),
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      return { kind: "cancelled" }
    }

    return { kind: "cancelled" }
  }
}

export function useSocialMediaDownloader() {
  const [progress, setProgress] = useState<DownloadProgress>({ phase: "download", progress: 0 })
  const resultUrl = useSocialMediaDownloaderStore((state) => state.resultUrl)
  const resolve = useMutation({ mutationFn: resolveSocialMediaEffect })
  const download = useMutation({
    mutationFn: (request: SocialMediaDownloadRequest) =>
      downloadSocialMediaEffect(request, setProgress),
    onMutate: () => setProgress({ phase: "download", progress: 0 }),
  })

  // architecture: external synchronization (route unmount cleanup)
  useEffect(
    () => () => {
      useSocialMediaDownloaderStore.getState().clearResult()
    },
    [],
  )

  const reset = () => {
    resolve.reset()
    download.reset()
    setProgress({ phase: "download", progress: 0 })
    useSocialMediaDownloaderStore.getState().clearResult()
  }

  const downloadTo = async (mode: "video" | "mp3", resolved: ResolvedSocialMedia) => {
    const format =
      mode === "video"
        ? (resolved.videoFormat ?? resolved.mergedVideo?.video ?? null)
        : resolved.audioFormat

    if (!format) return

    const extension =
      mode === "mp3"
        ? "mp3"
        : resolved.videoFormat
          ? videoExtension(resolved.videoFormat.container, resolved.videoFormat.mime_type)
          : (resolved.mergedVideo?.container ?? "mp4")
    const fileName = `${mediaFileStem(resolved.info.title)}.${extension}`
    let saveHandle: BrowserFileHandle | undefined

    if (mode === "video") {
      const target = await chooseSaveTarget(fileName)

      if (target.kind === "cancelled") return
      if (target.kind === "handle") saveHandle = target.handle
    }

    const merge =
      mode === "video" && !resolved.videoFormat && resolved.mergedVideo
        ? {
            video: resolved.mergedVideo.video,
            audio: resolved.mergedVideo.audio,
            container: resolved.mergedVideo.container,
          }
        : undefined
    const request: SocialMediaDownloadRequest = {
      format,
      platform: resolved.platform,
      fileName,
      mode,
      ...(resolved.videoId ? { videoId: resolved.videoId } : {}),
      ...(merge ? { merge } : {}),
      ...(saveHandle ? { saveHandle } : {}),
    }

    useSocialMediaDownloaderStore.getState().clearResult()

    const result = await download.mutateAsync(request).catch(() => null)

    if (result?.kind === "file") {
      useSocialMediaDownloaderStore.getState().setResultUrl(result.blob)
    }
  }

  return { resolve, download, progress, reset, downloadTo, resultUrl }
}
