import { createFileRoute } from "@tanstack/react-router"

import { MarkdownToWordPage } from "@/features/markdown-to-word/components/markdown-to-word-page"

export const Route = createFileRoute("/markdown/to-word")({ component: MarkdownToWordPage })
