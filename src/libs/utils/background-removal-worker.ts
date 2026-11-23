import { removeSolidBackground } from "./background-removal-solid"

interface RemoveRequest {
  readonly id: number
  readonly file: File
}

type RemoveResponse =
  | { readonly id: number; readonly type: "result"; readonly blob: Blob }
  | { readonly id: number; readonly type: "error"; readonly message: string }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RemoveRequest>) => void) | null
  postMessage: (message: RemoveResponse) => void
}

scope.onmessage = async (event) => {
  const { id, file } = event.data

  try {
    const blob = await removeSolidBackground(file)

    scope.postMessage({ id, type: "result", blob })
  } catch (cause) {
    scope.postMessage({
      id,
      type: "error",
      message: cause instanceof Error ? cause.message : "Could not remove the background.",
    })
  }
}
