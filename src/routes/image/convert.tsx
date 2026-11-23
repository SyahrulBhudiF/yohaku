import { createFileRoute } from "@tanstack/react-router"

import { ConvertPage } from "@/features/image-tools/components/convert-page"

export const Route = createFileRoute("/image/convert")({ component: ConvertPage })
