import { createFileRoute } from "@tanstack/react-router"

import { handleConvertImage } from "@/apis/image"

export const Route = createFileRoute("/api/image/convert")({
  server: { handlers: { POST: ({ request }) => handleConvertImage(request) } },
})
