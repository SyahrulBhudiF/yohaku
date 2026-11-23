import { createFileRoute } from "@tanstack/react-router"

import { CompressPage } from "@/features/image-tools/components/compress-page"

export const Route = createFileRoute("/image/compress")({ component: CompressPage })
