import type { WatermarkFormValues } from "@/libs/schemas/watermark"
import { decodeImage } from "@/libs/utils/image-codec/decode"
import { detectImageInputFormat } from "@/libs/utils/image-codec/detect"
import { encodeImage } from "@/libs/utils/image-codec/encode"
import { flattenOnWhite } from "@/libs/utils/image-resize"
import { watermarkFontSize, watermarkLogoWidth, watermarkPlacements } from "@/libs/utils/watermark"

interface WatermarkRequest {
  readonly id: number
  readonly image: ArrayBuffer
  readonly logo?: ArrayBuffer
  readonly options: WatermarkFormValues
}

type WatermarkErrorCode = "read" | "logo" | "encode" | "canvas"

type WatermarkResponse =
  | {
      readonly id: number
      readonly ok: true
      readonly data: ArrayBuffer
      readonly width: number
      readonly height: number
    }
  | { readonly id: number; readonly ok: false; readonly code: WatermarkErrorCode }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WatermarkRequest>) => void) | null
  postMessage: (message: WatermarkResponse, transfer?: Transferable[]) => void
}

const postError = (id: number, code: WatermarkErrorCode) =>
  scope.postMessage({ id, ok: false, code })

const decode = async (bytes: Uint8Array) => {
  const format = detectImageInputFormat(bytes)

  if (format === null) return null

  return decodeImage(bytes, format)
}

const drawText = (
  context: OffscreenCanvasRenderingContext2D,
  options: WatermarkFormValues,
  width: number,
  height: number,
) => {
  const text = options.text.trim()

  if (!text) return

  const fontSize = watermarkFontSize(width, options.size)

  context.font = `600 ${fontSize}px sans-serif`
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = options.color === "white" ? "#ffffff" : "#000000"
  context.globalAlpha = options.opacity / 100

  const measured = context.measureText(text).width
  const placements = watermarkPlacements({
    width,
    height,
    markWidth: measured,
    markHeight: fontSize,
    position: options.position,
    rotation: options.rotation,
  })

  for (const placement of placements) {
    context.save()
    context.translate(placement.x, placement.y)
    context.rotate((placement.angle * Math.PI) / 180)
    context.fillText(text, 0, 0)
    context.restore()
  }
}

const drawLogo = (
  context: OffscreenCanvasRenderingContext2D,
  logo: ImageData,
  options: WatermarkFormValues,
  width: number,
  height: number,
) => {
  const targetWidth = Math.min(width, watermarkLogoWidth(width, options.size))
  const targetHeight = (logo.height / logo.width) * targetWidth
  const scale = Math.min(1, (height * 0.45) / targetHeight)
  const drawWidth = targetWidth * scale
  const drawHeight = targetHeight * scale
  const logoCanvas = new OffscreenCanvas(logo.width, logo.height)
  const logoContext = logoCanvas.getContext("2d")

  if (!logoContext) return

  logoContext.putImageData(logo, 0, 0)
  context.globalAlpha = options.opacity / 100

  const placements = watermarkPlacements({
    width,
    height,
    markWidth: drawWidth,
    markHeight: drawHeight,
    position: options.position,
    rotation: options.rotation,
  })

  for (const placement of placements) {
    context.save()
    context.translate(placement.x, placement.y)
    context.rotate((placement.angle * Math.PI) / 180)
    context.drawImage(logoCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    context.restore()
  }
}

scope.onmessage = async ({ data }) => {
  try {
    const image = await decode(new Uint8Array(data.image))

    if (!image) {
      postError(data.id, "read")

      return
    }

    let logo: ImageData | null = null

    if (data.options.type === "logo" && data.logo) {
      logo = await decode(new Uint8Array(data.logo))

      if (!logo) {
        postError(data.id, "logo")

        return
      }
    }

    const canvas = new OffscreenCanvas(image.width, image.height)
    const context = canvas.getContext("2d")

    if (!context) {
      postError(data.id, "canvas")

      return
    }

    if (data.options.format === "jpeg") {
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, image.width, image.height)
    }

    context.putImageData(image, 0, 0)

    if (data.options.type === "logo" && logo) {
      drawLogo(context, logo, data.options, image.width, image.height)
    } else {
      drawText(context, data.options, image.width, image.height)
    }

    const output = context.getImageData(0, 0, image.width, image.height)

    if (data.options.format === "jpeg") {
      flattenOnWhite(output)
    }

    try {
      const bytes = await encodeImage(output, data.options.format, data.options.quality)

      scope.postMessage(
        {
          id: data.id,
          ok: true,
          data: bytes.buffer,
          width: image.width,
          height: image.height,
        },
        [bytes.buffer],
      )
    } catch {
      postError(data.id, "encode")
    }
  } catch {
    postError(data.id, "read")
  }
}
