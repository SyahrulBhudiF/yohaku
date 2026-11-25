import { createFileRoute } from "@tanstack/react-router"

import { ResizePage } from "@/features/image-tools/components/resize-page"

export const Route = createFileRoute("/image/resize")({ component: ResizePage })
