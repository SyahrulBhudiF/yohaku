import { Effect, Result } from "effect"

import { FileTooLargeError, ImageProcessingError } from "@/infrastructure/errors/image"
import { runEffect } from "@/infrastructure/runtime"
import { ImageProcessor } from "@/infrastructure/services/image-processor"
import {
  FAVICON_SIZES,
  MAX_FAVICON_BYTES,
  MAX_FAVICON_PIXELS,
  type FaviconFile,
  type FaviconOutput,
} from "@/libs/schemas/favicon"
import { buildFaviconSnippet, buildIco, buildWebManifest, fileBaseName } from "@/libs/utils/favicon"
import { detectImageInputFormat } from "@/libs/utils/image-codec"
import { readImageSize } from "@/libs/utils/image-decode"
import { createZipWriter } from "@/libs/utils/zip"

const encoder = new TextEncoder()

const textEntry = (name: string, text: string) => ({
  name,
  mime: name.endsWith(".webmanifest") ? "application/manifest+json" : "text/html",
  data: encoder.encode(text),
})

const program = (file: File) =>
  Effect.gen(function* () {
    if (file.size > MAX_FAVICON_BYTES) {
      return yield* new FileTooLargeError({
        message: `Images can be at most ${MAX_FAVICON_BYTES / 1024 / 1024} MB.`,
        maxBytes: MAX_FAVICON_BYTES,
      })
    }

    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: () => new ImageProcessingError({ message: "Could not read this image." }),
      }),
    )
    const source = detectImageInputFormat(bytes)

    if (source === null) {
      return yield* new ImageProcessingError({
        message: "Choose a readable PNG, JPEG, WebP, or AVIF image.",
      })
    }

    const measured = yield* Effect.tryPromise({
      try: () => readImageSize(file),
      catch: () => null,
    }).pipe(Effect.result)

    if (
      Result.isSuccess(measured) &&
      measured.success !== null &&
      measured.success.width * measured.success.height > MAX_FAVICON_PIXELS
    ) {
      return yield* new ImageProcessingError({
        message: `Use an image under ${MAX_FAVICON_PIXELS / 1_000_000} megapixels.`,
      })
    }

    const processor = yield* ImageProcessor
    const icons = yield* processor.favicons(bytes, FAVICON_SIZES)
    const bySize = new Map(icons.map((icon) => [icon.size, icon.data]))
    const size16 = bySize.get(16)
    const size32 = bySize.get(32)
    const size48 = bySize.get(48)
    const size180 = bySize.get(180)
    const size192 = bySize.get(192)
    const size512 = bySize.get(512)

    if (!size16 || !size32 || !size48 || !size180 || !size192 || !size512) {
      return yield* new ImageProcessingError({ message: "Could not create the icon files." })
    }

    const ico = buildIco([
      { size: 16, png: size16 },
      { size: 32, png: size32 },
      { size: 48, png: size48 },
    ])
    const base = fileBaseName(file.name)
    const manifest = textEntry("site.webmanifest", buildWebManifest(base))
    const snippet = textEntry("favicon-snippet.html", buildFaviconSnippet())
    const png = (name: string, data: Uint8Array) => ({
      name,
      mime: "image/png",
      data,
    })
    const files = [
      { name: "favicon.ico", mime: "image/x-icon", data: ico },
      png("favicon-16x16.png", size16),
      png("favicon-32x32.png", size32),
      png("favicon-48x48.png", size48),
      png("apple-touch-icon.png", size180),
      png("android-chrome-192x192.png", size192),
      png("android-chrome-512x512.png", size512),
      manifest,
      snippet,
    ]
    const writer = createZipWriter()

    for (const entry of files) {
      writer.add(entry.name, entry.data)
    }

    const blob = writer.finish()
    const failure = writer.error()

    if (failure) {
      return yield* new ImageProcessingError({ message: "Could not build the icon ZIP." })
    }

    const summary: Array<FaviconFile> = files.map((entry) => ({
      name: entry.name,
      mime: entry.mime,
      bytes: entry.data.byteLength,
    }))

    return {
      blob,
      preview: new Blob([size512], { type: "image/png" }),
      fileName: `${base}-favicons.zip`,
      inputBytes: file.size,
      zipBytes: blob.size,
      files: summary,
    } satisfies FaviconOutput
  })

export const generateFavicons = (file: File): Promise<FaviconOutput> => runEffect(program(file))
