import { createFileRoute } from "@tanstack/react-router"

import { VideoToGifPage } from "@/features/video-to-gif/components/video-to-gif-page"

export const Route = createFileRoute("/media/video-to-gif")({ component: VideoToGifPage })
