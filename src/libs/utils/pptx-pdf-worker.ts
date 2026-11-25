import init, { convert_pptx_to_pdf } from "@/libs/wasm/pptx-pdf-core/pptx_pdf_core.js"

type ConvertRequest =
  | { readonly type: "warm" }
  | {
      readonly type: "convert"
      readonly id: number
      readonly bytes: ArrayBuffer
    }

type ConvertResponse =
  | { readonly type: "ready" }
  | {
      readonly type: "result"
      readonly id: number
      readonly ok: true
      readonly bytes: ArrayBuffer
    }
  | {
      readonly type: "result"
      readonly id: number
      readonly ok: false
      readonly message: string
    }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ConvertRequest>) => void) | null
  postMessage: (message: ConvertResponse, transfer?: Transferable[]) => void
}

let initialized: Promise<unknown> | undefined

const ensureLoaded = () => {
  initialized ??= init().catch((cause: unknown) => {
    initialized = undefined
    throw cause
  })

  return initialized
}

scope.onmessage = async ({ data }) => {
  try {
    await ensureLoaded()

    if (data.type === "warm") {
      scope.postMessage({ type: "ready" })

      return
    }

    const output = convert_pptx_to_pdf(new Uint8Array(data.bytes))
    const bytes = output.buffer as ArrayBuffer

    scope.postMessage({ type: "result", id: data.id, ok: true, bytes }, [bytes])
  } catch (cause) {
    if (data.type === "warm") {
      return
    }

    scope.postMessage({
      type: "result",
      id: data.id,
      ok: false,
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}
