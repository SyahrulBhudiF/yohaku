import { createFileRoute } from "@tanstack/react-router"

import { MetadataCleanerPage } from "@/features/image-metadata/components/metadata-cleaner-page"

export const Route = createFileRoute("/image/remove-metadata")({
  component: MetadataCleanerPage,
})
