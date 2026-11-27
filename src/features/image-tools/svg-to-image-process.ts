import { Effect, Schema } from "effect"

import { SvgToImageError } from "@/infrastructure/errors/svg-to-image"
import { runEffect } from "@/infrastructure/runtime"
import {
  MAX_SVG_BYTES,
  MAX_SVG_PIXELS,
  MAX_SVG_SIDE,
  SvgToImageOutputSchema,
  type SvgOutputFormat,
  type SvgToImageOutput,
} from "@/libs/schemas/svg-to-image"

export interface ConvertSvgToImageInput {
  readonly file: File
  readonly format: SvgOutputFormat
  readonly width: number
  readonly quality: number
}

const isSvgFile = (file: File) =>
  file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml"

const fileBaseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "image"

const MIME: Record<SvgOutputFormat, string> = {
  png: "image/png",
  webp: "image/webp",
}

const externalUrlPattern = /url\(\s*['"]?(?!#|data:image\/)/i

const hasExternalReferences = (doc: Document) => {
  for (const element of doc.querySelectorAll("*")) {
    for (const attribute of ["href", "xlink:href", "src"]) {
      const value = element.getAttribute(attribute)

      if (value && !value.startsWith("#") && !value.startsWith("data:image/")) {
        return true
      }
    }

    const style = element.getAttribute("style")

    if (style && (externalUrlPattern.test(style) || /@import/i.test(style))) {
      return true
    }
  }

  for (const style of doc.querySelectorAll("style")) {
    if (
      externalUrlPattern.test(style.textContent ?? "") ||
      /@import/i.test(style.textContent ?? "")
    ) {
      return true
    }
  }

  return false
}

const sanitizeSvg = async (source: string) => {
  const { default: DOMPurify } = await import("dompurify")
  const sanitized = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      "script",
      "foreignObject",
      "iframe",
      "object",
      "embed",
      "audio",
      "video",
      "canvas",
    ],
  })
  const doc = new DOMParser().parseFromString(sanitized, "image/svg+xml")
  const parserError = doc.querySelector("parsererror")

  if (parserError || doc.documentElement.nodeName.toLowerCase() !== "svg") {
    throw new SvgToImageError({ message: "This file is not a valid SVG image." })
  }

  if (hasExternalReferences(doc)) {
    throw new SvgToImageError({
      message: "This SVG references an external file. Save a self-contained SVG and try again.",
    })
  }

  return new XMLSerializer().serializeToString(doc.documentElement)
}

const targetSize = (width: number, intrinsicWidth: number, intrinsicHeight: number) => {
  const ratio = intrinsicWidth > 0 ? intrinsicHeight / intrinsicWidth : 150 / 300
  let targetWidth = Math.max(1, Math.min(MAX_SVG_SIDE, Math.round(width)))
  let targetHeight = Math.max(1, Math.round(targetWidth * ratio))

  if (targetHeight > MAX_SVG_SIDE) {
    targetHeight = MAX_SVG_SIDE
    targetWidth = Math.max(1, Math.round(targetHeight / ratio))
  }

  const pixels = targetWidth * targetHeight

  if (pixels > MAX_SVG_PIXELS) {
    const scale = Math.sqrt(MAX_SVG_PIXELS / pixels)

    targetWidth = Math.max(1, Math.floor(targetWidth * scale))
    targetHeight = Math.max(1, Math.floor(targetHeight * scale))
  }

  return { width: targetWidth, height: targetHeight }
}

const rasterizeSvg = async (source: string, input: ConvertSvgToImageInput) => {
  const mimeType = MIME[input.format]
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }))

  try {
    const image = new Image()

    image.decoding = "async"

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new SvgToImageError({ message: "Could not render this SVG." }))
      image.src = url
    })

    const intrinsicWidth = image.naturalWidth || 300
    const intrinsicHeight = image.naturalHeight || 150
    const size = targetSize(input.width, intrinsicWidth, intrinsicHeight)
    const canvas = document.createElement("canvas")

    canvas.width = size.width
    canvas.height = size.height

    const context = canvas.getContext("2d")

    if (!context) {
      throw new SvgToImageError({ message: "Could not create an image canvas." })
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, size.width, size.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result)
          } else {
            reject(new SvgToImageError({ message: "Could not encode the converted image." }))
          }
        },
        mimeType,
        input.format === "webp" ? input.quality / 100 : undefined,
      )
    })

    if (blob.type !== mimeType) {
      throw new SvgToImageError({
        message: `This browser could not encode ${input.format.toUpperCase()}. Try PNG instead.`,
      })
    }

    return {
      blob,
      fileName: `${fileBaseName(input.file.name)}.${input.format}`,
      mimeType,
      inputBytes: input.file.size,
      bytes: blob.size,
      width: size.width,
      height: size.height,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const program = (input: ConvertSvgToImageInput) =>
  Effect.gen(function* () {
    if (input.file.size === 0 || input.file.size > MAX_SVG_BYTES) {
      return yield* new SvgToImageError({
        message:
          input.file.size === 0
            ? "This file is empty."
            : `SVG files can be at most ${MAX_SVG_BYTES / 1024 / 1024} MB.`,
      })
    }

    if (!isSvgFile(input.file)) {
      return yield* new SvgToImageError({ message: "Choose an SVG file." })
    }

    const source = yield* Effect.tryPromise({
      try: () => input.file.text(),
      catch: () => new SvgToImageError({ message: "Could not read this SVG." }),
    })
    const sanitized = yield* Effect.tryPromise({
      try: () => sanitizeSvg(source),
      catch: (cause) =>
        cause instanceof SvgToImageError
          ? cause
          : new SvgToImageError({ message: "Could not sanitize this SVG." }),
    })
    const output = yield* Effect.tryPromise({
      try: () => rasterizeSvg(sanitized, input),
      catch: (cause) =>
        cause instanceof SvgToImageError
          ? cause
          : new SvgToImageError({ message: "Could not convert this SVG." }),
    })

    return yield* Schema.decodeEffect(SvgToImageOutputSchema)(output).pipe(
      Effect.mapError(() => new SvgToImageError({ message: "Could not prepare the result." })),
    )
  })

export const convertSvgToImage = (input: ConvertSvgToImageInput): Promise<SvgToImageOutput> =>
  runEffect(program(input))
