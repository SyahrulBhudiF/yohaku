import { createFileRoute } from "@tanstack/react-router"

import { VideoToMp3Page } from "@/features/video-to-mp3/components/video-to-mp3-page"

export const Route = createFileRoute("/media/video-to-mp3")({ component: VideoToMp3Page })
