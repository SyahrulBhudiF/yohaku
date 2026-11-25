import type { LoadedPdfDocument } from "@/libs/utils/pdf/pdfjs"

interface DocumentEntry {
  readonly promise: Promise<LoadedPdfDocument>
  readonly urls: Set<string>
  disposed: boolean
}

const documents = new Map<string, DocumentEntry>()
const thumbnails = new Map<string, Promise<string | null>>()
const previews = new Map<string, Promise<PdfPagePreview | null>>()

export interface PdfPagePreview {
  readonly url: string
  readonly aspect: number
}

export const getPdfDocument = (
  fileId: string,
  file: File,
  password?: string,
): Promise<LoadedPdfDocument> => {
  const existing = documents.get(fileId)

  if (existing) {
    return existing.promise
  }

  const promise = import("@/libs/utils/pdf/pdfjs").then(({ loadPdfDocument }) =>
    loadPdfDocument(file, password),
  )
  const entry: DocumentEntry = { promise, urls: new Set(), disposed: false }

  documents.set(fileId, entry)
  promise.catch(() => {
    if (documents.get(fileId) === entry) {
      documents.delete(fileId)
    }
  })

  return promise
}

export const getPdfThumbnail = (
  fileId: string,
  file: File,
  pageNumber: number,
  password?: string,
): Promise<string | null> => {
  const key = `${fileId}:${pageNumber}`
  const existing = thumbnails.get(key)

  if (existing) {
    return existing
  }

  const promise = getPdfDocument(fileId, file, password).then(async ({ document }) => {
    const { renderPageThumbnail } = await import("@/libs/utils/pdf/pdfjs")
    const url = await renderPageThumbnail(document, pageNumber)
    const entry = documents.get(fileId)

    if (url) {
      if (entry && !entry.disposed) {
        entry.urls.add(url)
      } else {
        URL.revokeObjectURL(url)
      }
    }

    return url
  })

  thumbnails.set(key, promise)
  promise.catch(() => {
    thumbnails.delete(key)
  })

  return promise
}

export const getPdfPagePreview = (
  fileId: string,
  file: File,
  pageNumber: number,
  password?: string,
  targetWidth = 900,
): Promise<PdfPagePreview | null> => {
  const key = `${fileId}:${pageNumber}:${targetWidth}`

  const existing = previews.get(key)

  if (existing) {
    return existing
  }

  const promise = getPdfDocument(fileId, file, password).then(async ({ document }) => {
    const { renderPageThumbnail } = await import("@/libs/utils/pdf/pdfjs")
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })

    page.cleanup()

    const url = await renderPageThumbnail(document, pageNumber, targetWidth)

    if (!url) {
      return null
    }

    const entry = documents.get(fileId)

    if (entry && !entry.disposed) {
      entry.urls.add(url)
    } else {
      URL.revokeObjectURL(url)
    }

    return { url, aspect: viewport.width / viewport.height }
  })

  previews.set(key, promise)
  promise.catch(() => {
    previews.delete(key)
  })

  return promise
}

export const disposePdfFile = (fileId: string) => {
  const entry = documents.get(fileId)

  documents.delete(fileId)

  if (entry) {
    entry.disposed = true
  }

  for (const key of [...thumbnails.keys()]) {
    if (key.startsWith(`${fileId}:`)) {
      thumbnails.delete(key)
    }
  }

  for (const key of [...previews.keys()]) {
    if (key.startsWith(`${fileId}:`)) {
      previews.delete(key)
    }
  }

  if (entry) {
    for (const url of entry.urls) {
      URL.revokeObjectURL(url)
    }

    void entry.promise.then(({ destroy }) => destroy()).catch(() => null)
  }
}

export const disposeAllPdfFiles = () => {
  for (const fileId of [...documents.keys()]) {
    disposePdfFile(fileId)
  }

  thumbnails.clear()
  previews.clear()
}
