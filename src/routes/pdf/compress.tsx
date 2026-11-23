import { createFileRoute } from "@tanstack/react-router"

import { CompressPdfPage } from "@/features/pdf-compress/components/compress-pdf-page"

export const Route = createFileRoute("/pdf/compress")({ component: CompressPdfPage })
