import { Effect } from "effect"

import { FileTooLargeError, ImageProcessingError } from "@/infrastructure/errors/image"
import { runEffect } from "@/infrastructure/runtime"
import { MAX_METADATA_BYTES, type MetadataCleanerOutput } from "@/libs/schemas/image-metadata"
import { detectMetadataFormat, stripImageMetadata } from "@/libs/utils/image-metadata"

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "image"

const program = (file: File) =>
  Effect.gen(function* () {
    if (file.size > MAX_METADATA_BYTES) {
      return yield* new FileTooLargeError({
        message: `Images can be at most ${MAX_METADATA_BYTES / 1024 / 1024} MB.`,
        maxBytes: MAX_METADATA_BYTES,
      })
    }

    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: () => new ImageProcessingError({ message: "Could not read this image." }),
      }),
    )
    const format = detectMetadataFormat(bytes)

    if (format === null) {
      return yield* new ImageProcessingError({ message: "Use a JPEG or PNG image." })
    }

    const cleaned = stripImageMetadata(bytes)

    if (!cleaned) {
      return yield* new ImageProcessingError({ message: "This image could not be read." })
    }

    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png"
    const extension = format === "jpeg" ? "jpg" : "png"

    return {
      blob: new Blob([cleaned.data], { type: mimeType }),
      fileName: `${fileBaseName(file.name)}-clean.${extension}`,
      format,
      inputBytes: file.size,
      outputBytes: cleaned.data.byteLength,
      removedBytes: cleaned.report.removedBytes,
      fields: cleaned.report.fields,
    } satisfies MetadataCleanerOutput
  })

export const cleanImageMetadata = (file: File): Promise<MetadataCleanerOutput> =>
  runEffect(program(file))
