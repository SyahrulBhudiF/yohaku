import { Schema } from "effect"

export const MAX_FAVICON_BYTES = 25 * 1024 * 1024
export const MAX_FAVICON_PIXELS = 24_000_000

export const FAVICON_SIZES = [16, 32, 48, 180, 192, 512] as const

export const FaviconFileSchema = Schema.Struct({
  name: Schema.String,
  bytes: Schema.Int,
  mime: Schema.String,
})

export type FaviconFile = typeof FaviconFileSchema.Type

export const FaviconOutputSchema = Schema.Struct({
  blob: Schema.instanceOf(Blob),
  preview: Schema.instanceOf(Blob),
  fileName: Schema.String,
  inputBytes: Schema.Int,
  zipBytes: Schema.Int,
  files: Schema.Array(FaviconFileSchema),
})

export type FaviconOutput = typeof FaviconOutputSchema.Type
