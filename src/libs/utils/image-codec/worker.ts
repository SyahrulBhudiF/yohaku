import type { ImageFormat } from "@/libs/schemas/image"
import type { AnimatedFormat } from "./animation"
import { animationErrorMessage } from "./animation"
import { decodeHeicPreview, decodeImage, measureHeic } from "./decode"
import { detectImageInputFormat } from "./detect"
import { encodeImage } from "./encode"
import { transcodeGif } from "./gif"
import { optimizePng } from "./oxipng"
import { warmImageCodec } from "./preload"
import type {
  EncodeRequest,
  EncodeResponse,
  MeasureRequest,
  MeasureResponse,
  ResizeRequest,
  ResizeResponse,
  TranscodeRequest,
  TranscodeResponse,
  WorkerRequest,
  WorkerResponse,
} from "./protocol"
import { isAnimatedWebp, transcodeWebpAnimation } from "./webp-animation"
import { fitImageDataWithin, flattenOnWhite, resizeImageData } from "@/libs/utils/image-resize"

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope
const warming = new Map<ImageFormat, Promise<void>>()

const warm = (format: ImageFormat) => {
  const existing = warming.get(format)

  if (existing) {
    return existing
  }

  const promise = warmImageCodec(format)

  warming.set(format, promise)

  return promise
}

const transcode = async (request: TranscodeRequest): Promise<TranscodeResponse> => {
  const source = detectImageInputFormat(request.bytes)

  if (source === null) {
    return {
      type: "transcode",
      id: request.id,
      ok: false,
      message: "The file is not a readable image.",
    }
  }

  await warm(request.format)

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
    image =
      request.preview && source === "heic"
        ? await decodeHeicPreview(request.bytes)
        : await decodeImage(request.bytes, source)
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

  if (request.maxSide) {
    image = fitImageDataWithin(image, request.maxSide)
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
  const source = detectImageInputFormat(request.bytes)

  if (source === null) {
    return {
      type: "resize",
      id: request.id,
      ok: false,
      message: "The file is not a readable image.",
    }
  }

  await warm(request.format)

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
    await warm(request.format)

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

const measure = async (request: MeasureRequest): Promise<MeasureResponse> => {
  const source = detectImageInputFormat(request.bytes)

  if (source === null) {
    return {
      type: "measure",
      id: request.id,
      ok: false,
      message: "The file is not a readable image.",
    }
  }

  if (source === "heic") {
    try {
      const size = await measureHeic(request.bytes)

      return { type: "measure", id: request.id, ok: true, ...size }
    } catch {
      // Fall back to a full decode for containers the metadata parser rejects.
    }
  }

  try {
    const image = await decodeImage(request.bytes, source)

    if (image === null) {
      return {
        type: "measure",
        id: request.id,
        ok: false,
        message: `Could not decode ${source}.`,
      }
    }

    return {
      type: "measure",
      id: request.id,
      ok: true,
      width: image.width,
      height: image.height,
    }
  } catch {
    return { type: "measure", id: request.id, ok: false, message: "Could not read this image." }
  }
}

scope.onmessage = (event) => {
  const request = event.data

  if (request.type === "preload") {
    void warm(request.format)

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

  if (request.type === "measure") {
    void measure(request).then((response) => scope.postMessage(response))

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
