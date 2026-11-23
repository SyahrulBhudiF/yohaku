import * as pdfjs from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import type { PDFDocumentProxy } from "pdfjs-dist"

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
