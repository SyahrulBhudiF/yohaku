import { createFileRoute } from "@tanstack/react-router"

import { WordToPdfPage } from "@/features/word-to-pdf/components/word-to-pdf-page"

export const Route = createFileRoute("/word/to-pdf")({ component: WordToPdfPage })
