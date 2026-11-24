import { createFileRoute } from "@tanstack/react-router"

import { PdfProtectPage } from "@/features/pdf-protect/components/pdf-protect-page"

export const Route = createFileRoute("/pdf/protect")({ component: PdfProtectPage })
