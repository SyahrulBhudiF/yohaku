import { createFileRoute } from "@tanstack/react-router"

import { SplitPage } from "@/features/pdf-tools/components/split-page"

export const Route = createFileRoute("/pdf/split")({ component: SplitPage })
