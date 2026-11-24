import { createFileRoute } from "@tanstack/react-router"

import { PdfToWordPage } from "@/features/pdf-to-word/components/pdf-to-word-page"

export const Route = createFileRoute("/pdf/to-word")({ component: PdfToWordPage })
