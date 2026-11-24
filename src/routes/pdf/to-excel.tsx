import { createFileRoute } from "@tanstack/react-router"

import { PdfToExcelPage } from "@/features/pdf-to-excel/components/pdf-to-excel-page"

export const Route = createFileRoute("/pdf/to-excel")({ component: PdfToExcelPage })
