import {
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateRadians,
  translate,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib"

import { PdfAnnotateError } from "@/infrastructure/errors/pdf"
import type { PdfAnnotateLogo, PdfAnnotateOptions } from "./types"

const pageRotation = (page: PDFPage) => {
  const angle = ((page.getRotation().angle % 360) + 360) % 360

  return angle === 90 || angle === 180 || angle === 270 ? angle : 0
}

const displaySize = (page: PDFPage) => {
  const { width, height } = page.getSize()

  return pageRotation(page) === 90 || pageRotation(page) === 270
    ? { width: height, height: width }
    : { width, height }
}

/**
 * Maps display coordinates (origin bottom-left as the page is shown) back
 * through the page's clockwise `/Rotate` value. Drawing inside this state
 * keeps annotations upright on rotated pages.
 */
const withDisplaySpace = (page: PDFPage, draw: () => void) => {
  const rotation = pageRotation(page)

  if (rotation === 0) {
    draw()

    return
  }

  const { width, height } = page.getSize()
  const matrix: [number, number, number, number, number, number] =
    rotation === 90
      ? [0, 1, -1, 0, width, 0]
      : rotation === 180
        ? [-1, 0, 0, -1, width, height]
        : [0, -1, 1, 0, 0, height]

  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...matrix))
  draw()
  page.pushOperators(popGraphicsState())
}

const formatNumber = (
  value: number,
  format: PdfAnnotateOptions["number"]["format"],
  total: number,
) => {
  if (format === "page-number") {
    return `Page ${value}`
  }

  if (format === "number-total") {
    return `${value} / ${total}`
  }

  return String(value)
}

const numberPosition = (
  page: PDFPage,
  width: number,
  height: number,
  margin: number,
  position: PdfAnnotateOptions["number"]["position"],
) => {
  const { width: pageWidth, height: pageHeight } = displaySize(page)
  const x = position.endsWith("left")
    ? margin
    : position.endsWith("right")
      ? pageWidth - margin - width
      : (pageWidth - width) / 2
  const y = position.startsWith("top")
    ? pageHeight - margin - height
    : position.startsWith("middle")
      ? (pageHeight - height) / 2
      : margin

  return { x, y }
}

const withRotation = (
  page: PDFPage,
  centerX: number,
  centerY: number,
  angle: number,
  draw: () => void,
) => {
  page.pushOperators(
    pushGraphicsState(),
    translate(centerX, centerY),
    rotateRadians((angle * Math.PI) / 180),
    translate(-centerX, -centerY),
  )
  draw()
  page.pushOperators(popGraphicsState())
}

const drawCenteredText = (
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  opacity: number,
  angle: number,
  centerX?: number,
  centerY?: number,
) => {
  const { width: pageWidth, height: pageHeight } = displaySize(page)
  const textWidth = font.widthOfTextAtSize(text, size)
  const textHeight = font.heightAtSize(size)
  const cx = centerX ?? pageWidth / 2
  const cy = centerY ?? pageHeight / 2

  withRotation(page, cx, cy, angle, () => {
    page.drawText(text, {
      x: cx - textWidth / 2,
      y: cy - textHeight / 2,
      size,
      font,
      color: rgb(0.38, 0.38, 0.38),
      opacity,
    })
  })
}

const drawCenteredImage = (
  page: PDFPage,
  image: PDFImage,
  width: number,
  opacity: number,
  angle: number,
  centerX?: number,
  centerY?: number,
) => {
  const { width: pageWidth, height: pageHeight } = displaySize(page)
  const height = (width * image.height) / image.width
  const cx = centerX ?? pageWidth / 2
  const cy = centerY ?? pageHeight / 2

  withRotation(page, cx, cy, angle, () => {
    page.drawImage(image, {
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      opacity,
    })
  })
}

export const annotatePdf = async (
  bytes: ArrayBuffer,
  options: PdfAnnotateOptions,
  logo?: PdfAnnotateLogo,
): Promise<Uint8Array<ArrayBuffer>> => {
  let document: PDFDocument

  try {
    document = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (cause) {
    const name = typeof cause === "object" && cause !== null && "name" in cause ? cause.name : null

    throw new PdfAnnotateError({
      message:
        name === "EncryptedPDFError"
          ? "This PDF is password-protected. Unlock it first."
          : "This PDF could not be read.",
    })
  }

  const pages = document.getPages()
  const total = pages.length
  const selected = options.pages.filter((page) => page >= 1 && page <= total)
  const numberFont =
    options.mode === "numbers" ? await document.embedFont(StandardFonts.Helvetica) : null
  const watermarkFont =
    options.mode === "watermark" ? await document.embedFont(StandardFonts.HelveticaBold) : null
  const watermarkImage =
    options.mode === "watermark" && options.watermark.kind === "image" && logo
      ? logo.kind === "png"
        ? await document.embedPng(new Uint8Array(logo.bytes))
        : await document.embedJpg(new Uint8Array(logo.bytes))
      : null
  let number = options.number.start

  for (const pageNumber of selected) {
    const page = pages[pageNumber - 1]

    if (!page) {
      continue
    }

    if (options.mode === "numbers" && numberFont) {
      const text = formatNumber(number, options.number.format, total)
      const width = numberFont.widthOfTextAtSize(text, options.number.fontSize)
      const height = numberFont.heightAtSize(options.number.fontSize)
      const position = numberPosition(
        page,
        width,
        height,
        options.number.margin,
        options.number.position,
      )

      withDisplaySpace(page, () => {
        page.drawText(text, {
          ...position,
          size: options.number.fontSize,
          font: numberFont,
          color: rgb(0.12, 0.14, 0.13),
        })
      })
      number += 1
    }

    if (options.mode === "watermark" && watermarkFont) {
      const { width: pageWidth, height: pageHeight } = displaySize(page)
      const watermark = options.watermark
      const opacity = watermark.opacity / 100
      const rotation = watermark.rotation
      const tiled = watermark.placement === "tiled"

      withDisplaySpace(page, () => {
        if (watermark.kind === "text") {
          const text = watermark.text.trim()
          const widthLimit = pageWidth * (tiled ? 0.3 : 0.9)
          const fitSize = widthLimit / watermarkFont.widthOfTextAtSize(text, 1)
          const size = Math.min(watermark.fontSize, fitSize)

          if (tiled) {
            for (let row = 0; row < 4; row += 1) {
              for (let column = 0; column < 3; column += 1) {
                drawCenteredText(
                  page,
                  watermarkFont,
                  text,
                  size,
                  opacity,
                  rotation,
                  (column + 0.5) * (pageWidth / 3),
                  (row + 0.5) * (pageHeight / 4),
                )
              }
            }
          } else {
            drawCenteredText(page, watermarkFont, text, size, opacity, rotation)
          }
        } else if (watermarkImage) {
          const width = pageWidth * (watermark.scale / 100) * (tiled ? 0.42 : 1)
          const height = (width * watermarkImage.height) / watermarkImage.width
          const fitWidth =
            height > pageHeight * 0.8
              ? (pageHeight * 0.8 * watermarkImage.width) / watermarkImage.height
              : width

          if (tiled) {
            for (let row = 0; row < 3; row += 1) {
              for (let column = 0; column < 2; column += 1) {
                drawCenteredImage(
                  page,
                  watermarkImage,
                  fitWidth,
                  opacity,
                  rotation,
                  (column + 0.5) * (pageWidth / 2),
                  (row + 0.5) * (pageHeight / 3),
                )
              }
            }
          } else {
            drawCenteredImage(page, watermarkImage, fitWidth, opacity, rotation)
          }
        }
      })
    }
  }

  return new Uint8Array(await document.save({ useObjectStreams: true }))
}
