import { Effect, Schema } from "effect"

import {
  FileTooLargeError,
  ImageProcessingError,
  InvalidRequestError,
  UnsupportedFormatError,
} from "@/infrastructure/errors/image"
import { runEffect } from "@/infrastructure/runtime"
import { ImageProcessor } from "@/infrastructure/services/image-processor"
import {
  FormDataQualitySchema,
  IMAGE_EXTENSION,
  IMAGE_MIME,
  ImageFormatSchema,
  MAX_IMAGE_BYTES,
  type ApiError,
} from "@/libs/schemas/image"

const ConvertFormSchema = Schema.Struct({
  format: ImageFormatSchema,
  quality: FormDataQualitySchema,
})

const CompressFormSchema = Schema.Struct({
  quality: FormDataQualitySchema,
  format: Schema.optionalKey(ImageFormatSchema),
})

type ImageApiError =
  | InvalidRequestError
  | FileTooLargeError
  | UnsupportedFormatError
  | ImageProcessingError

const statusByTag: Record<ImageApiError["_tag"], number> = {
  InvalidRequestError: 400,
  FileTooLargeError: 413,
  UnsupportedFormatError: 415,
  ImageProcessingError: 422,
}

const readFile = Effect.fn("image.readFile")(function* (form: FormData) {
  const file = form.get("file")

  if (!(file instanceof File)) {
    return yield* new InvalidRequestError({ message: "Attach an image in the `file` field." })
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return yield* new FileTooLargeError({
      message: `Images can be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      maxBytes: MAX_IMAGE_BYTES,
    })
  }

  return file
})

const decodeOptions = <S extends Schema.Decoder<unknown>>(schema: S, form: FormData) => {
  const fields: unknown = Object.fromEntries([...form.entries()].filter(([key]) => key !== "file"))

  return Schema.decodeUnknownEffect(schema)(fields).pipe(
    Effect.mapError(() => new InvalidRequestError({ message: "Invalid format or quality." })),
  )
}

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "image"

const toResponse = (
  original: File,
  output: { data: Uint8Array; format: keyof typeof IMAGE_MIME },
  suffix: string,
) =>
  new Response(output.data as BodyInit, {
    headers: {
      "Content-Type": IMAGE_MIME[output.format],
      "Content-Disposition": `attachment; filename="${fileBaseName(original.name)}${suffix}.${IMAGE_EXTENSION[output.format]}"`,
      "X-Original-Bytes": String(original.size),
      "X-Result-Bytes": String(output.data.byteLength),
      "Cache-Control": "no-store",
    },
  })

const convertProgram = Effect.fn("image.convert")(function* (form: FormData) {
  const file = yield* readFile(form)
  const { format, quality } = yield* decodeOptions(ConvertFormSchema, form)
  const processor = yield* ImageProcessor
  const input = new Uint8Array(yield* Effect.promise(() => file.arrayBuffer()))
  const output = yield* processor.transcode(input, format, quality)

  return toResponse(file, output, "")
})

const compressProgram = Effect.fn("image.compress")(function* (form: FormData) {
  const file = yield* readFile(form)
  const options = yield* decodeOptions(CompressFormSchema, form)
  const processor = yield* ImageProcessor
  const input = new Uint8Array(yield* Effect.promise(() => file.arrayBuffer()))
  const format = options.format ?? (yield* processor.detectFormat(input))
  const output = yield* processor.transcode(input, format, options.quality)

  return toResponse(file, output, "-compressed")
})

const errorResponse = (error: ImageApiError) => {
  const body: ApiError = { _tag: error._tag, message: error.message }

  return Response.json(body, { status: statusByTag[error._tag] })
}

export const handleConvertImage = (form: FormData) =>
  runEffect(
    convertProgram(form).pipe(Effect.catch((error) => Effect.succeed(errorResponse(error)))),
  )

export const handleCompressImage = (form: FormData) =>
  runEffect(
    compressProgram(form).pipe(Effect.catch((error) => Effect.succeed(errorResponse(error)))),
  )
