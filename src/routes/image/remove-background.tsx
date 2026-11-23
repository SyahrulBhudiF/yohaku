import { createFileRoute } from "@tanstack/react-router"

import { RemoveBackgroundPage } from "@/features/image-tools/components/remove-background-page"

export const Route = createFileRoute("/image/remove-background")({
  component: RemoveBackgroundPage,
})
