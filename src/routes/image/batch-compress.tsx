import { createFileRoute } from "@tanstack/react-router"

import { BatchCompressPage } from "@/features/image-tools/components/batch-compress-page"

export const Route = createFileRoute("/image/batch-compress")({
  component: BatchCompressPage,
})
