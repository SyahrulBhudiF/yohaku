import * as pdfjs from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { MAX_PDF_IMAGE_PIXELS } from "@/libs/schemas/pdf"

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface LoadedPdfDocument {
  readonly document: PDFDocumentProxy
  readonly pageCount: number
  readonly destroy: () => Promise<void>
}

export const loadPdfDocument = async (
  file: File,
  password?: string,
): Promise<LoadedPdfDocument> => {
  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument(password === undefined ? { data } : { data, password })
  const document = await task.promise

  return { document, pageCount: document.numPages, destroy: () => task.destroy() }
}

export const renderPageThumbnail = async (
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  targetWidth = 360,
): Promise<string | null> => {
  const page = await pdfDocument.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: targetWidth / base.width })
  const canvas = window.document.createElement("canvas")

  canvas.width = Math.max(1, Math.ceil(viewport.width))
  canvas.height = Math.max(1, Math.ceil(viewport.height))

  const context = canvas.getContext("2d")

  if (!context) {
    page.cleanup()

    return null
  }

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({ canvas, canvasContext: context, viewport }).promise
  page.cleanup()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.84)
  })

  return blob ? URL.createObjectURL(blob) : null
}

export const createPdfRenderCanvas = (): HTMLCanvasElement | null =>
  typeof window === "undefined" ? null : window.document.createElement("canvas")

/**
 * Render a full PDF page to a canvas. Returns null when the page would exceed
 * the pixel budget or the browser has no canvas.
 *
 * Pass the same canvas for every page in a batch; resizing only when the page
 * dimensions change avoids reallocating a multi-megabyte backing store.
 */
export const renderPdfPageToCanvas = async (
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  canvas?: HTMLCanvasElement,
): Promise<HTMLCanvasElement | null> => {
  if (typeof window === "undefined") {
    return null
  }

  const page = await pdfDocument.getPage(pageNumber)

  try {
    const viewport = page.getViewport({ scale })

    if (viewport.width * viewport.height > MAX_PDF_IMAGE_PIXELS) {
      return null
    }

    const target = canvas ?? window.document.createElement("canvas")
    const width = Math.max(1, Math.ceil(viewport.width))
    const height = Math.max(1, Math.ceil(viewport.height))

    if (target.width !== width) {
      target.width = width
    }

    if (target.height !== height) {
      target.height = height
    }

    const context = target.getContext("2d")

    if (!context) {
      return null
    }

    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
    await page.render({ canvas: target, canvasContext: context, viewport }).promise

    return target
  } finally {
    page.cleanup()
  }
}

/** Render a full PDF page to RGBA pixels for the wasm encoder path. */
export const renderPdfPage = async (
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  canvas?: HTMLCanvasElement,
): Promise<ImageData | null> => {
  const target = await renderPdfPageToCanvas(pdfDocument, pageNumber, scale, canvas)

  if (!target) {
    return null
  }

  const context = target.getContext("2d")

  return context ? context.getImageData(0, 0, target.width, target.height) : null
}

/** Encode the canvas with the browser's native codec, avoiding a pixel copy. */
export const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality)
  })
