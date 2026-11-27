import { createFileRoute } from "@tanstack/react-router"

import { CsvExcelPage } from "@/features/csv-excel/components/csv-excel-page"

export const Route = createFileRoute("/csv-excel")({
  component: CsvExcelPage,
})
