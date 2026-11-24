import { ImageProcessingError } from "@/infrastructure/errors/image"

import { decodeImageData } from "./image-decode"
import { removeBackgroundWasm } from "./background-removal-wasm"

const MAX_SIDE = 4096

const canvasToPng = (canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> => {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/png" })
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)

        return
      }

      reject(new ImageProcessingError({ message: "Could not encode the transparent PNG." }))
    }, "image/png")
  })
}

const makeCanvas = (width: number, height: number): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height)
  }

  const canvas = document.createElement("canvas")

  canvas.width = width
  canvas.height = height

  return canvas
}

/** Removes a uniform studio background with the Rust/WASM matte. */
export const removeSolidBackground = async (file: File): Promise<Blob> => {
  const image = await decodeImageData(file, MAX_SIDE)

  if (!image) {
    throw new ImageProcessingError({ message: "Could not read this image in this browser." })
  }

  const { data, width, height } = image
  const pixels = await removeBackgroundWasm(data, width, height)

  if (!pixels) {
    throw new ImageProcessingError({ message: "Could not run the background matte." })
  }

  const canvas = makeCanvas(width, height)
  const context = canvas.getContext("2d")

  if (!context) {
    throw new ImageProcessingError({ message: "Could not create the transparent PNG." })
  }

  // The wasm glue returns a fresh ArrayBuffer-backed view from `.slice()`.
  context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0)

  return canvasToPng(canvas)
}
