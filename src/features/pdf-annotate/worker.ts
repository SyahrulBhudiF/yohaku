import { annotatePdf } from "./annotate"
import type { PdfAnnotateLogo, PdfAnnotateOptions } from "./types"

interface AnnotateRequest {
  readonly id: number
  readonly bytes: ArrayBuffer
  readonly options: PdfAnnotateOptions
  readonly logo?: PdfAnnotateLogo
}

type AnnotateResponse =
  | { readonly id: number; readonly type: "result"; readonly bytes: ArrayBuffer }
  | { readonly id: number; readonly type: "error"; readonly message: string }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AnnotateRequest>) => void) | null
  postMessage: (message: AnnotateResponse, transfer?: Transferable[]) => void
}

scope.onmessage = async ({ data }) => {
  try {
    const bytes = await annotatePdf(data.bytes, data.options, data.logo)

    scope.postMessage({ id: data.id, type: "result", bytes: bytes.buffer }, [bytes.buffer])
  } catch (cause) {
    scope.postMessage({
      id: data.id,
      type: "error",
      message: cause instanceof Error ? cause.message : "Could not annotate this PDF.",
    })
  }
}
