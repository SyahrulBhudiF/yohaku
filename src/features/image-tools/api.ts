import { Schema } from "effect"

import { compressImage, convertImage } from "@/apis/image"
import { ApiErrorSchema, type ImageFormat, type ImageResult } from "@/libs/schemas/image"

export type ImageToolMode = "convert" | "compress"

export interface ProcessImageInput {
  readonly mode: ImageToolMode
  readonly file: File
  readonly format: ImageFormat | undefined
  readonly quality: number
}

export type ProcessImageOutput = ImageResult & { readonly blob: Blob }

const decodeError = Schema.decodeUnknownOption(ApiErrorSchema)

const readFileName = (header: string | null, fallback: string) =>
  /filename="([^"]+)"/.exec(header ?? "")?.[1] ?? fallback

const toError = async (cause: unknown) => {
  if (!(cause instanceof Response)) {
    return new Error("Could not reach the server. Try again.")
  }

  const payload: unknown = await cause.json().catch(() => null)
  const message = decodeError(payload)

  return new Error(
    message._tag === "Some" ? message.value.message : "The server could not process this image.",
  )
}

export const processImage = async (input: ProcessImageInput): Promise<ProcessImageOutput> => {
  const body = new FormData()

  body.set("file", input.file)
  body.set("quality", String(input.quality))

  if (input.format !== undefined) {
    body.set("format", input.format)
  }

  const send = input.mode === "convert" ? convertImage : compressImage
  const response = await send({ data: body }).catch(async (cause: unknown) => {
    throw await toError(cause)
  })
  const blob = await response.blob()

  return {
    blob,
    fileName: readFileName(response.headers.get("Content-Disposition"), input.file.name),
    mimeType: blob.type,
    originalBytes: input.file.size,
    resultBytes: blob.size,
  }
}
