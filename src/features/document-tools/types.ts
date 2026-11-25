export type DocumentConversionOutput = {
  readonly blob: Blob
  readonly fileName: string
  readonly inputBytes: number
  readonly outputBytes: number
  readonly text?: string
}

export type DocumentConversionResult = Omit<DocumentConversionOutput, "blob"> & {
  readonly url: string
}
