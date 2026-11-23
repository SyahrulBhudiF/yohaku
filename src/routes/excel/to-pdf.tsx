import { createFileRoute } from "@tanstack/react-router"

import { ExcelToPdfPage } from "@/features/document-tools/components/excel-to-pdf-page"

export const Route = createFileRoute("/excel/to-pdf")({ component: ExcelToPdfPage })
