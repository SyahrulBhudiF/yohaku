import { createFileRoute } from "@tanstack/react-router"

import { PowerPointToPdfPage } from "@/features/powerpoint-to-pdf/components/powerpoint-to-pdf-page"

export const Route = createFileRoute("/powerpoint/to-pdf")({ component: PowerPointToPdfPage })
