import { createFileRoute } from "@tanstack/react-router"

import { PdfAnnotatePage } from "@/features/pdf-annotate/components/pdf-annotate-page"

export const Route = createFileRoute("/pdf/annotate")({ component: PdfAnnotatePage })
