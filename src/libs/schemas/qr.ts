import { Schema } from "effect"

export const MAX_QR_TEXT_CHARS = 2_048
export const MAX_QR_TEXT_BYTES = 2_048
export const MAX_QR_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_QR_IMAGE_PIXELS = 24_000_000

export const QrCodeFormatSchema = Schema.Literals(["png", "svg"])
export type QrCodeFormat = typeof QrCodeFormatSchema.Type
export const QR_CODE_FORMATS = QrCodeFormatSchema.literals

export const QrCodeFormSchema = Schema.Struct({
  text: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_QR_TEXT_CHARS)),
  format: QrCodeFormatSchema,
})

export type QrCodeFormValues = typeof QrCodeFormSchema.Type

export const GeneratedQrCodeSchema = Schema.Struct({
  dataUrl: Schema.String,
  fileName: Schema.String,
  format: QrCodeFormatSchema,
})

export type GeneratedQrCode = typeof GeneratedQrCodeSchema.Type

export const ScannedQrCodeSchema = Schema.String
