import { createFileRoute } from "@tanstack/react-router"

import { SignPdfPage } from "@/features/pdf-sign/components/sign-pdf-page"

export const Route = createFileRoute("/pdf/sign")({ component: SignPdfPage })
