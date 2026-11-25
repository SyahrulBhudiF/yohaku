import { createFileRoute } from "@tanstack/react-router"

import { PdfToMarkdownPage } from "@/features/pdf-to-markdown/components/pdf-to-markdown-page"

export const Route = createFileRoute("/pdf/to-markdown")({
  component: PdfToMarkdownPage,
  headers: () => ({
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  }),
})
