import { createFileRoute } from "@tanstack/react-router"

import { handleCompressImage } from "@/apis/image"

export const Route = createFileRoute("/api/image/compress")({
  server: { handlers: { POST: ({ request }) => handleCompressImage(request) } },
})
