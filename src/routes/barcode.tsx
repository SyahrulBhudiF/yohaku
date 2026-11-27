import { createFileRoute } from "@tanstack/react-router"

import { BarcodePage } from "@/features/barcode/components/barcode-page"

export const Route = createFileRoute("/barcode")({ component: BarcodePage })
