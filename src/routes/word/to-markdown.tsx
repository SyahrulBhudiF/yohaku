import { createFileRoute } from "@tanstack/react-router"

import { WordToMarkdownPage } from "@/features/word-to-markdown/components/word-to-markdown-page"

export const Route = createFileRoute("/word/to-markdown")({ component: WordToMarkdownPage })
