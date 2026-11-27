import { createFileRoute } from "@tanstack/react-router"

import { SvgToImagePage } from "@/features/image-tools/components/svg-to-image-page"

export const Route = createFileRoute("/image/svg-to-image")({
  component: SvgToImagePage,
})
