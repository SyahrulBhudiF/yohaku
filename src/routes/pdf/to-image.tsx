import { createFileRoute } from "@tanstack/react-router"

import { PdfToImagePage } from "@/features/pdf-tools/components/pdf-to-image-page"

export const Route = createFileRoute("/pdf/to-image")({ component: PdfToImagePage })
