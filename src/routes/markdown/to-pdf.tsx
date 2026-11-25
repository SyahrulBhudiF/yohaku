import { createFileRoute } from "@tanstack/react-router"

import { MarkdownToPdfPage } from "@/features/markdown-to-pdf/components/markdown-to-pdf-page"

export const Route = createFileRoute("/markdown/to-pdf")({ component: MarkdownToPdfPage })
