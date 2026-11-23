const PREVIEWABLE_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
])

/** Browsers cannot render TIFF (and some raw formats) in an `<img>`. */
export const isPreviewableImageMime = (mimeType: string): boolean =>
  PREVIEWABLE_IMAGE_MIME_TYPES.has(mimeType)
