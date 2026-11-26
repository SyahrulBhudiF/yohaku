import { Schema } from "effect"

import { QualitySchema } from "./image"

export const MAX_WATERMARK_BYTES = 25 * 1024 * 1024
export const MAX_WATERMARK_LOGO_BYTES = 5 * 1024 * 1024
export const MAX_WATERMARK_PIXELS = 24_000_000
export const MAX_WATERMARK_TEXT_CHARS = 120

export const WatermarkTypeSchema = Schema.Literals(["text", "logo"])
export type WatermarkType = typeof WatermarkTypeSchema.Type

export const WatermarkPositionSchema = Schema.Literals([
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
  "tiled",
])
export type WatermarkPosition = typeof WatermarkPositionSchema.Type

export const WatermarkColorSchema = Schema.Literals(["white", "black"])
export type WatermarkColor = typeof WatermarkColorSchema.Type

export const WatermarkFormatSchema = Schema.Literals(["png", "jpeg", "webp"])
export type WatermarkFormat = typeof WatermarkFormatSchema.Type

export const WatermarkFormSchema = Schema.Struct({
  type: WatermarkTypeSchema,
  text: Schema.String.check(Schema.isMaxLength(MAX_WATERMARK_TEXT_CHARS)),
  position: WatermarkPositionSchema,
  opacity: Schema.Int.check(Schema.isBetween({ minimum: 5, maximum: 100 })),
  rotation: Schema.Int.check(Schema.isBetween({ minimum: -90, maximum: 90 })),
  size: Schema.Int.check(Schema.isBetween({ minimum: 5, maximum: 60 })),
  color: WatermarkColorSchema,
  format: WatermarkFormatSchema,
  quality: QualitySchema,
})

export type WatermarkFormValues = typeof WatermarkFormSchema.Type

export const WATERMARK_FORMAT_MIME: Record<WatermarkFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

export const WATERMARK_FORMAT_EXTENSION: Record<WatermarkFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
}

export const WATERMARK_POSITION_LABEL: Record<WatermarkPosition, string> = {
  "top-left": "Top left",
  top: "Top",
  "top-right": "Top right",
  left: "Left",
  center: "Center",
  right: "Right",
  "bottom-left": "Bottom left",
  bottom: "Bottom",
  "bottom-right": "Bottom right",
  tiled: "Tiled",
}

export const WatermarkOutputSchema = Schema.Struct({
  blob: Schema.instanceOf(Blob),
  fileName: Schema.String,
  mimeType: Schema.String,
  inputBytes: Schema.Int,
  bytes: Schema.Int,
  width: Schema.Int,
  height: Schema.Int,
})

export type WatermarkOutput = typeof WatermarkOutputSchema.Type
