import { createFileRoute } from "@tanstack/react-router"

import { FaviconPage } from "@/features/favicon/components/favicon-page"

export const Route = createFileRoute("/image/favicon")({ component: FaviconPage })
