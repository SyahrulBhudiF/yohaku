import { createFileRoute } from "@tanstack/react-router"

import { MergePage } from "@/features/pdf-tools/components/merge-page"

export const Route = createFileRoute("/pdf/merge")({ component: MergePage })
