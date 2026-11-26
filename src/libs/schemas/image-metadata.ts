import { Schema } from "effect"

export const MAX_METADATA_BYTES = 25 * 1024 * 1024

export const MetadataFieldSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
})

export type MetadataField = typeof MetadataFieldSchema.Type

export const MetadataCleanerOutputSchema = Schema.Struct({
  blob: Schema.instanceOf(Blob),
  fileName: Schema.String,
  format: Schema.Literals(["jpeg", "png"]),
  inputBytes: Schema.Int,
  outputBytes: Schema.Int,
  removedBytes: Schema.Int,
  fields: Schema.Array(MetadataFieldSchema),
})

export type MetadataCleanerOutput = typeof MetadataCleanerOutputSchema.Type
