import { createFileRoute } from "@tanstack/react-router"

import { PdfReorganizePage } from "@/features/pdf-reorganize/components/pdf-reorganize-page"

export const Route = createFileRoute("/pdf/reorganize")({ component: PdfReorganizePage })
