import init, { convert_docx_to_pdf } from "@/libs/wasm/word-pdf-core/word_pdf_core.js"

interface ConvertRequest {
  readonly id: number
  readonly bytes: ArrayBuffer
}

type ConvertResponse =
  | { readonly id: number; readonly type: "result"; readonly bytes: ArrayBuffer }
  | { readonly id: number; readonly type: "error"; readonly message: string }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ConvertRequest>) => void) | null
  postMessage: (message: ConvertResponse, transfer?: Transferable[]) => void
}

let initialized: Promise<unknown> | undefined

scope.onmessage = async ({ data }) => {
  try {
    initialized ??= init()
    await initialized

    const result = convert_docx_to_pdf(new Uint8Array(data.bytes))
    const bytes = result.buffer as ArrayBuffer

    scope.postMessage({ id: data.id, type: "result", bytes }, [bytes])
  } catch (cause) {
    scope.postMessage({
      id: data.id,
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}
