import { Schema } from "effect"

export const MAX_BARCODE_VALUE_CHARS = 128
export const MAX_BARCODE_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_BARCODE_IMAGE_PIXELS = 24_000_000

export const BarcodeFormatSchema = Schema.Literals(["code128", "ean13", "upca"])
export type BarcodeFormat = typeof BarcodeFormatSchema.Type
export const BARCODE_FORMATS = BarcodeFormatSchema.literals

export const BarcodeFormSchema = Schema.Struct({
  format: BarcodeFormatSchema,
  value: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_BARCODE_VALUE_CHARS)),
})

export type BarcodeFormValues = typeof BarcodeFormSchema.Type

export const GeneratedBarcodeSchema = Schema.Struct({
  svgDataUrl: Schema.String,
  pngDataUrl: Schema.String,
  fileName: Schema.String,
  format: BarcodeFormatSchema,
  text: Schema.String,
})

export type GeneratedBarcode = typeof GeneratedBarcodeSchema.Type

export const ScannedBarcodeSchema = Schema.Struct({
  format: Schema.String,
  text: Schema.String,
})

export type ScannedBarcode = typeof ScannedBarcodeSchema.Type
