import type {
  PdfAnnotateFormValues,
  PdfNumberFormat,
  PdfNumberPosition,
  PdfWatermarkPlacement,
} from "@/libs/schemas/pdf"

export interface PdfAnnotateNumberOptions {
  readonly start: number
  readonly format: PdfNumberFormat
  readonly position: PdfNumberPosition
  readonly fontSize: number
  readonly margin: number
}

export interface PdfAnnotateWatermarkOptions {
  readonly kind: "text" | "image"
  readonly text: string
  readonly placement: PdfWatermarkPlacement
  readonly opacity: number
  readonly rotation: number
  readonly fontSize: number
  readonly scale: number
}

export interface PdfAnnotateOptions {
  readonly mode: PdfAnnotateFormValues["mode"]
  readonly pages: ReadonlyArray<number>
  readonly number: PdfAnnotateNumberOptions
  readonly watermark: PdfAnnotateWatermarkOptions
}

export interface PdfAnnotateLogo {
  readonly bytes: ArrayBuffer
  readonly kind: "png" | "jpeg"
}
