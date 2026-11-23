import { createFileRoute } from "@tanstack/react-router"

import { ImageToPdfPage } from "@/features/image-tools/components/image-to-pdf-page"

export const Route = createFileRoute("/image/to-pdf")({ component: ImageToPdfPage })
