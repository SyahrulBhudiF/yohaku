import { decodeImage } from "./decode"
import { detectImageFormat } from "./detect"
import { encodeImage } from "./encode"
import { warmImageCodec } from "./preload"
import type { TranscodeRequest, TranscodeResponse, WorkerRequest } from "./protocol"

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: TranscodeResponse, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope

const transcode = async (request: TranscodeRequest): Promise<TranscodeResponse> => {
  const source = detectImageFormat(request.bytes)

  if (source === null) {
    return {
      type: "transcode",
      id: request.id,
      ok: false,
      message: "The file is not a readable image.",
    }
  }

  let image: ImageData | null

  try {
    image = await decodeImage(request.bytes, source)
  } catch {
    return { type: "transcode", id: request.id, ok: false, message: "Could not read this image." }
  }

  if (image === null) {
    return {
      type: "transcode",
      id: request.id,
      ok: false,
      message: `Could not decode ${source}.`,
    }
  }

  try {
    const data = await encodeImage(image, request.format, request.quality)

    return { type: "transcode", id: request.id, ok: true, data, format: request.format }
  } catch {
    return {
      type: "transcode",
      id: request.id,
      ok: false,
      message: `Could not encode the image as ${request.format}.`,
    }
  }
}

scope.onmessage = (event) => {
  const request = event.data

  if (request.type === "preload") {
    void warmImageCodec(request.format)

    return
  }

  void transcode(request).then((response) => {
    if (response.ok) {
      scope.postMessage(response, [response.data.buffer])
    } else {
      scope.postMessage(response)
    }
  })
}
