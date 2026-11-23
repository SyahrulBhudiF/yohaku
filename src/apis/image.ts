import { createServerFn } from "@tanstack/react-start"

import { handleCompressImage, handleConvertImage } from "./image.server"

const requireFormData = (data: unknown) => {
  if (!(data instanceof FormData)) {
    throw new Response("Expected multipart form data.", { status: 400 })
  }

  return data
}

const failOnError = (response: Response) => {
  if (!response.ok) {
    throw response
  }

  return response
}

export const convertImage = createServerFn({ method: "POST" })
  .validator(requireFormData)
  .handler(async ({ data }) => failOnError(await handleConvertImage(data)))

export const compressImage = createServerFn({ method: "POST" })
  .validator(requireFormData)
  .handler(async ({ data }) => failOnError(await handleCompressImage(data)))
