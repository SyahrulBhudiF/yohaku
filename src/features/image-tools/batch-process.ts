import { Effect, Result, Schema } from "effect"

import { BatchImageError } from "@/infrastructure/errors/image"
import { runEffect } from "@/infrastructure/runtime"
import { imageWorkerLimit } from "@/libs/utils/image-codec"
import { createZipWriter } from "@/libs/utils/zip"
import {
  BatchCompressInputSchema,
  MAX_IMAGE_FILES,
  MAX_IMAGE_TOTAL_BYTES,
  type BatchCompressInput,
  type BatchCompressOutput,
  type BatchCompressedFailure,
  type BatchCompressedItem,
  type BatchImageInputFile,
} from "@/libs/schemas/image"
import { processImageEffect, type ProcessImageOutput } from "./process"

const uniqueName = (name: string, used: Set<string>) => {
  if (!used.has(name)) {
    used.add(name)

    return name
  }

  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ""
  let suffix = 2

  while (used.has(`${base}-${suffix}${extension}`)) {
    suffix += 1
  }

  const next = `${base}-${suffix}${extension}`

  used.add(next)

  return next
}

const program = (input: BatchCompressInput) =>
  Effect.gen(function* () {
    if (input.files.length === 0) {
      return yield* new BatchImageError({ message: "Add at least one image." })
    }

    if (input.files.length > MAX_IMAGE_FILES) {
      return yield* new BatchImageError({
        message: `You can compress at most ${MAX_IMAGE_FILES} images at once.`,
      })
    }

    const decoded = yield* Schema.decodeEffect(BatchCompressInputSchema)(input).pipe(
      Effect.mapError(() => new BatchImageError({ message: "The batch settings are not valid." })),
    )
    const totalBytes = decoded.files.reduce((total, entry) => total + entry.size, 0)

    if (totalBytes > MAX_IMAGE_TOTAL_BYTES) {
      return yield* new BatchImageError({
        message: `The combined images can be at most ${MAX_IMAGE_TOTAL_BYTES / 1024 / 1024} MB.`,
      })
    }

    const outcomes = yield* Effect.forEach(
      decoded.files,
      (entry) =>
        Effect.map(
          Effect.result(
            processImageEffect({
              mode: "compress",
              file: entry.file,
              format: decoded.format === "original" ? undefined : decoded.format,
              quality: decoded.quality,
            }),
          ),
          (result) => ({ entry, result }),
        ),
      // Each codec worker handles one request at a time; separate workers
      // encode in parallel up to the browser's hardware limit.
      { concurrency: imageWorkerLimit() },
    )
    const items: Array<BatchCompressedItem> = []
    const failures: Array<BatchCompressedFailure> = []
    const successes: Array<{ entry: BatchImageInputFile; output: ProcessImageOutput }> = []

    for (const outcome of outcomes) {
      if (Result.isFailure(outcome.result)) {
        failures.push({
          id: outcome.entry.id,
          name: outcome.entry.name,
          message: outcome.result.failure.message,
        })
      } else {
        successes.push({ entry: outcome.entry, output: outcome.result.success })
      }
    }

    if (successes.length === 0) {
      return yield* new BatchImageError({
        message: failures[0]?.message ?? "None of these images could be compressed.",
      })
    }

    const writer = createZipWriter()
    const used = new Set<string>()
    let outputBytes = 0

    for (const success of successes) {
      const output = success.output
      const bytes = new Uint8Array(
        yield* Effect.tryPromise({
          try: () => output.blob.arrayBuffer(),
          catch: () => new BatchImageError({ message: `Could not read ${output.fileName}.` }),
        }),
      )
      const fileName = uniqueName(output.fileName, used)

      writer.add(fileName, bytes)
      outputBytes += output.resultBytes
      items.push({
        id: success.entry.id,
        fileName,
        inputBytes: output.originalBytes,
        outputBytes: output.resultBytes,
        mimeType: output.mimeType,
      })
    }

    const blob = writer.finish()
    const error = writer.error()

    if (error) {
      return yield* new BatchImageError({ message: "Could not create the ZIP archive." })
    }

    return {
      blob,
      fileName: "compressed-images.zip",
      inputBytes: totalBytes,
      outputBytes,
      zipBytes: blob.size,
      items,
      failures,
    }
  })

export const compressImages = (input: BatchCompressInput): Promise<BatchCompressOutput> =>
  runEffect(program(input))
