import { createFileRoute } from "@tanstack/react-router"

import { WatermarkPage } from "@/features/image-watermark/components/watermark-page"

export const Route = createFileRoute("/image/watermark")({ component: WatermarkPage })
