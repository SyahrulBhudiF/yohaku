import { createFileRoute } from "@tanstack/react-router"

import { SocialMediaDownloaderPage } from "@/features/social-media-downloader/components/social-media-downloader-page"

export const Route = createFileRoute("/media/social-downloader")({
  component: SocialMediaDownloaderPage,
})
