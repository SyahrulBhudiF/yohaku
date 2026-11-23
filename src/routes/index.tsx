import { createFileRoute } from "@tanstack/react-router"

import { ToolGrid } from "@/features/tools/components/tool-grid"

export const Route = createFileRoute("/")({ component: ToolGrid })
