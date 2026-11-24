import { imagesToPdfWasm } from "@/libs/utils/image-pdf-wasm"
import type { ImagePdfPageSize } from "@/libs/schemas/pdf"

interface BuildRequest {
  readonly id: number
  readonly images: ReadonlyArray<{
    readonly data: ArrayBuffer
    readonly format: "png" | "jpeg"
  }>
  readonly pageSize: ImagePdfPageSize
}

type BuildResponse =
  | { readonly id: number; readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly id: number; readonly ok: false; readonly message: string }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BuildRequest>) => void) | null
  postMessage: (message: BuildResponse, transfer?: Transferable[]) => void
}

scope.onmessage = async ({ data }) => {
  const result = await imagesToPdfWasm(
    data.images.map((image) => ({
      data: new Uint8Array(image.data),
      format: image.format,
    })),
    data.pageSize,
  )

  if (result.ok) {
    const bytes = result.bytes.buffer as ArrayBuffer

    scope.postMessage({ id: data.id, ok: true, bytes }, [bytes])

    return
  }

  scope.postMessage({ id: data.id, ok: false, message: result.message })
}
