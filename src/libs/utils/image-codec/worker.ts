import type { AnimatedFormat } from "./animation"
import { animationErrorMessage } from "./animation"
import { decodeImage } from "./decode"
import { detectImageFormat } from "./detect"
import { encodeImage } from "./encode"
import { transcodeGif } from "./gif"
import { optimizePng } from "./oxipng"
import { warmImageCodec } from "./preload"
import type {
  EncodeRequest,
  EncodeResponse,
  ResizeRequest,
  ResizeResponse,
  TranscodeRequest,
  TranscodeResponse,
  WorkerRequest,
  WorkerResponse,
} from "./protocol"
import { isAnimatedWebp, transcodeWebpAnimation } from "./webp-animation"
import { flattenOnWhite, resizeImageData } from "@/libs/utils/image-resize"

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void
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

  if (source === "png" && request.format === "png") {
    try {
      const data = await optimizePng(request.bytes)

      return { type: "transcode", id: request.id, ok: true, data, format: "png" }
    } catch {
      return {
        type: "transcode",
        id: request.id,
        ok: false,
        message: "Could not optimize this PNG.",
      }
    }
  }

  const animationTarget: AnimatedFormat | null =
    request.format === "gif" || request.format === "webp" ? request.format : null
  const animationSource: AnimatedFormat | null =
    source === "gif" || (source === "webp" && isAnimatedWebp(request.bytes)) ? source : null

  if (animationTarget !== null && animationSource !== null) {
    const message = animationErrorMessage(animationSource, animationTarget)

    try {
      const data =
        animationSource === "gif"
          ? await transcodeGif(request.bytes, animationTarget, request.quality)
          : await transcodeWebpAnimation(request.bytes, animationTarget, request.quality)

      if (!data) {
        return {
          type: "transcode",
          id: request.id,
          ok: false,
          message,
        }
      }

      return { type: "transcode", id: request.id, ok: true, data, format: animationTarget }
    } catch {
      return {
        type: "transcode",
        id: request.id,
        ok: false,
        message,
      }
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

const resize = async (request: ResizeRequest): Promise<ResizeResponse> => {
  const source = detectImageFormat(request.bytes)

  if (source === null) {
    return {
      type: "resize",
      id: request.id,
      ok: false,
      message: "The file is not a readable image.",
    }
  }

  let image: ImageData | null

  try {
    image = await decodeImage(request.bytes, source)
  } catch {
    return { type: "resize", id: request.id, ok: false, message: "Could not read this image." }
  }

  if (image === null) {
    return {
      type: "resize",
      id: request.id,
      ok: false,
      message: `Could not decode ${source}.`,
    }
  }

  const resized = resizeImageData(image, request.options)

  if (request.format === "jpeg") {
    flattenOnWhite(resized)
  }

  try {
    const data = await encodeImage(resized, request.format, request.quality)

    return {
      type: "resize",
      id: request.id,
      ok: true,
      data,
      format: request.format,
      width: resized.width,
      height: resized.height,
    }
  } catch {
    return {
      type: "resize",
      id: request.id,
      ok: false,
      message: `Could not encode the image as ${request.format}.`,
    }
  }
}

const encode = async (request: EncodeRequest): Promise<EncodeResponse> => {
  try {
    const image = new ImageData(request.data, request.width, request.height)
    const data = await encodeImage(image, request.format, request.quality)

    return { type: "encode", id: request.id, ok: true, data, format: request.format }
  } catch {
    return {
      type: "encode",
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

  if (request.type === "resize") {
    void resize(request).then((response) => {
      if (response.ok) {
        scope.postMessage(response, [response.data.buffer])
      } else {
        scope.postMessage(response)
      }
    })

    return
  }

  if (request.type === "encode") {
    void encode(request).then((response) => {
      if (response.ok) {
        scope.postMessage(response, [response.data.buffer])
      } else {
        scope.postMessage(response)
      }
    })

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
