import { createFileRoute } from "@tanstack/react-router"

import { QrCodePage } from "@/features/qr-code/components/qr-code-page"

export const Route = createFileRoute("/qr-code")({ component: QrCodePage })
