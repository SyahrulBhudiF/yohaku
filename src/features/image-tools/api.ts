import { Effect, Schema } from "effect"

import {
  ApiErrorSchema,
  type ImageFormat,
  type ImageResult,
  QualitySchema,
} from "@/libs/schemas/image"

export type ImageToolMode = "convert" | "compress"

export interface ProcessImageInput {
  readonly mode: ImageToolMode
  readonly file: File
  readonly format: ImageFormat | undefined
  readonly quality: number
}

export class ProcessImageError extends Schema.TaggedError<
  ProcessImageError,
  { readonly brand: unique symbol }
>()("ProcessImageError", { message: Schema.String }) {}

const decodeError = Schema.decodeUnknownOption(ApiErrorSchema)

const toFailure = (cause: unknown) =>
  cause instanceof ProcessImageError
    ? cause
    : new ProcessImageError({ message: "Could not reach the server. Try again." })

const readFileName = (header: string | null, fallback: string) =>
  /filename="([^"]+)"/.exec(header ?? "")?.[1] ?? fallback

const send = Effect.fn("processImage.send")(function* (input: ProcessImageInput) {
  const quality = yield* Schema.decodeEffect(QualitySchema)(input.quality).pipe(
    Effect.mapError(
      () => new ProcessImageError({ message: "Quality must be a whole number from 1 to 100." }),
    ),
  )
  const body = new FormData()

  body.set("file", input.file)
  body.set("quality", String(quality))

  if (input.format !== undefined) {
    body.set("format", input.format)
  }

  const response = yield* Effect.tryPromise({
    try: () => fetch(`/api/image/${input.mode}`, { method: "POST", body }),
    catch: toFailure,
  })

  if (!response.ok) {
    const payload = yield* Effect.tryPromise({ try: () => response.json(), catch: toFailure }).pipe(
      Effect.orElseSucceed(() => null),
    )
    const message = decodeError(payload)

    return yield* new ProcessImageError({
      message:
        message._tag === "Some"
          ? message.value.message
          : "The server could not process this image.",
    })
  }

  const blob = yield* Effect.tryPromise({ try: () => response.blob(), catch: toFailure })

  return {
    blob,
    fileName: readFileName(response.headers.get("Content-Disposition"), input.file.name),
    mimeType: blob.type,
    originalBytes: input.file.size,
    resultBytes: blob.size,
  } satisfies ImageResult & { blob: Blob }
})

export const processImage = (input: ProcessImageInput) => Effect.runPromise(send(input))
