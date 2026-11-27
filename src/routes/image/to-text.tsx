import { createFileRoute } from "@tanstack/react-router"

import { ImageToTextPage } from "@/features/image-to-text/components/image-to-text-page"

export const Route = createFileRoute("/image/to-text")({
  component: ImageToTextPage,
  headers: () => ({
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  }),
})
