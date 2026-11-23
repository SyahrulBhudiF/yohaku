import { createFileRoute } from "@tanstack/react-router"

import { ExtractPage } from "@/features/pdf-tools/components/extract-page"

export const Route = createFileRoute("/pdf/extract")({ component: ExtractPage })
