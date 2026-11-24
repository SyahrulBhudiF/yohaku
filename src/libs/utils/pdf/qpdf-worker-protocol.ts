import type { Qpdf } from "@mssio/qpdf-wasm"

export type QpdfWorkerMethod =
  | "compress"
  | "decrypt"
  | "encrypt"
  | "info"
  | "rotate"
  | "run"
  | "selectPages"
  | "split"

export interface QpdfWorkerBlob {
  readonly url: string
  readonly size: number
}

type QpdfResult = {
  readonly output: Uint8Array<ArrayBuffer> | Blob | QpdfWorkerBlob
  readonly warnings: Array<string>
}

export type PdfQpdf = Omit<
  Pick<
    Qpdf,
    "compress" | "decrypt" | "encrypt" | "info" | "rotate" | "run" | "selectPages" | "split"
  >,
  "decrypt" | "encrypt"
> & {
  readonly decrypt: (...args: Parameters<Qpdf["decrypt"]>) => Promise<QpdfResult>
  readonly encrypt: (...args: Parameters<Qpdf["encrypt"]>) => Promise<QpdfResult>
}

export interface QpdfWorkerRequest {
  readonly type: "run"
  readonly id: number
  readonly method: QpdfWorkerMethod
  readonly args: ReadonlyArray<unknown>
  readonly reportProgress: boolean
}

export type QpdfWorkerResponse =
  | { readonly id: number; readonly type: "progress"; readonly percent: number }
  | { readonly id: number; readonly type: "result"; readonly result: unknown }
  | {
      readonly id: number
      readonly type: "error"
      readonly message: string
      readonly code?: string
    }
