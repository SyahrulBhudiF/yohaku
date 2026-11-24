export interface PdfProtectionMetadata {
  readonly fileName: string
  readonly operation: "protected" | "unlocked"
  readonly inputBytes: number
  readonly outputBytes: number
}

export type PdfProtectionOutput = PdfProtectionMetadata &
  ({ readonly blob: Blob; readonly url?: never } | { readonly url: string; readonly blob?: never })

export type PdfProtectionResult = PdfProtectionMetadata & { readonly url: string }
