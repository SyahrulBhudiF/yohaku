import { Schema } from "effect"

export const MAX_IMAGE_OCR_BYTES = 20 * 1024 * 1024
export const MAX_IMAGE_OCR_PIXELS = 8_000_000
export const MAX_IMAGE_OCR_SIDE = 1_600

export const ImageOcrFormSchema = Schema.Struct({
  preferAccuracy: Schema.Boolean,
})

export type ImageOcrFormValues = typeof ImageOcrFormSchema.Type

export const ImageOcrProgressSchema = Schema.Struct({
  phase: Schema.Literals(["loading-model", "recognizing"]),
})

export type ImageOcrProgress = typeof ImageOcrProgressSchema.Type

export const ImageOcrOutputSchema = Schema.Struct({
  text: Schema.String,
  fileName: Schema.String,
  inputBytes: Schema.Int,
  outputBytes: Schema.Int,
})

export type ImageOcrOutput = typeof ImageOcrOutputSchema.Type
