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
  const wasmPixels = await removeBackgroundWasm(data, width, height)

  if (!wasmPixels) {
    throw new ImageProcessingError({ message: "Could not run the background matte." })
  }

  data.set(wasmPixels)

  const canvas = makeCanvas(width, height)
  const context = canvas.getContext("2d")

  if (!context) {
    throw new ImageProcessingError({ message: "Could not create the transparent PNG." })
  }

  // Canvas ImageData requires an ArrayBuffer-backed view; normalize the
  // decoded buffer once at this boundary.
  const pixels = new Uint8ClampedArray(data)

  context.putImageData(new ImageData(pixels, width, height), 0, 0)

  return canvasToPng(canvas)
}
