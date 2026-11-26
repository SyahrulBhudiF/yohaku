export type ToolCategory = "image" | "pdf" | "document" | "media"

// Enter and leave this tool with a document navigation so only OCR is isolated.
export const ISOLATED_OCR_PATH = "/pdf/to-markdown"

export interface ToolDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly category: ToolCategory
  readonly to:
    | "/image/convert"
    | "/image/compress"
    | "/image/batch-compress"
    | "/image/resize"
    | "/image/favicon"
    | "/image/watermark"
    | "/image/remove-metadata"
    | "/image/to-pdf"
    | "/image/remove-background"
    | "/pdf/merge"
    | "/pdf/compress"
    | "/pdf/extract"
    | "/pdf/split"
    | "/pdf/reorganize"
    | "/pdf/protect"
    | "/pdf/to-image"
    | "/pdf/to-word"
    | "/pdf/to-excel"
    | "/pdf/sign"
    | "/pdf/annotate"
    | "/excel/to-pdf"
    | "/word/to-pdf"
    | "/markdown/to-word"
    | "/markdown/to-pdf"
    | "/word/to-markdown"
    | "/pdf/to-markdown"
    | "/powerpoint/to-pdf"
    | "/media/video-to-mp3"
    | "/media/video-to-gif"
    | "/media/social-downloader"
    | "/qr-code"
    | null
}

/** Add new tools here. `to: null` renders a "coming soon" card. */
export const TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    id: "qr-code",
    title: "QR code generator & reader",
    description: "Create downloadable QR codes or read a QR code from an image.",
    category: "image",
    to: "/qr-code",
  },
  {
    id: "image-convert",
    title: "Convert image",
    description: "Convert HEIC, JPEG, PNG, WebP, AVIF, GIF and TIFF, or trace to SVG.",
    category: "image",
    to: "/image/convert",
  },
  {
    id: "image-compress",
    title: "Compress image",
    description: "Shrink file size and see how much you saved.",
    category: "image",
    to: "/image/compress",
  },
  {
    id: "image-batch-compress",
    title: "Batch compress images",
    description: "Compress up to 50 images with one setting and download a ZIP.",
    category: "image",
    to: "/image/batch-compress",
  },
  {
    id: "image-resize",
    title: "Resize image",
    description: "Change dimensions, crop, rotate, or flip an image without losing quality.",
    category: "image",
    to: "/image/resize",
  },
  {
    id: "favicon-generator",
    title: "Favicon & app icon generator",
    description: "Create favicon.ico, PNG app icons, a manifest, and a ZIP from one image.",
    category: "image",
    to: "/image/favicon",
  },
  {
    id: "image-watermark",
    title: "Image watermark",
    description: "Add text or a logo watermark, with position, opacity, rotation, and tiling.",
    category: "image",
    to: "/image/watermark",
  },
  {
    id: "image-metadata-cleaner",
    title: "Photo metadata cleaner",
    description: "Remove EXIF, GPS, and text metadata from JPEG and PNG images.",
    category: "image",
    to: "/image/remove-metadata",
  },
  {
    id: "image-to-pdf",
    title: "Image to PDF",
    description: "Convert HEIC and other images into one PDF, or make one PDF per image.",
    category: "image",
    to: "/image/to-pdf",
  },
  {
    id: "image-remove-background",
    title: "Remove background",
    description: "Cut out the subject and download a transparent PNG.",
    category: "image",
    to: "/image/remove-background",
  },
  {
    id: "pdf-merge",
    title: "Merge PDF",
    description: "Combine PDFs and reorder pages with drag and drop.",
    category: "pdf",
    to: "/pdf/merge",
  },
  {
    id: "pdf-compress",
    title: "Compress PDF",
    description: "Reduce PDF file size with lossless optimization, in your browser.",
    category: "pdf",
    to: "/pdf/compress",
  },
  {
    id: "pdf-extract",
    title: "Extract PDF pages",
    description: "Keep selected pages and save them as a new PDF.",
    category: "pdf",
    to: "/pdf/extract",
  },
  {
    id: "pdf-split",
    title: "Split PDF",
    description: "Split by page ranges and download the results as a ZIP.",
    category: "pdf",
    to: "/pdf/split",
  },
  {
    id: "pdf-reorganize",
    title: "Reorganize PDF pages",
    description: "Drag pages to reorder, rotate, or remove them.",
    category: "pdf",
    to: "/pdf/reorganize",
  },
  {
    id: "pdf-protect",
    title: "Protect or unlock PDF",
    description: "Add or remove AES-256 password protection in your browser.",
    category: "pdf",
    to: "/pdf/protect",
  },
  {
    id: "pdf-to-image",
    title: "PDF to image",
    description: "Render every PDF page as a PNG, JPEG, WebP, AVIF, GIF or TIFF.",
    category: "pdf",
    to: "/pdf/to-image",
  },
  {
    id: "pdf-to-word",
    title: "PDF to Word",
    description: "Extract selectable PDF text into an editable Word document.",
    category: "pdf",
    to: "/pdf/to-word",
  },
  {
    id: "pdf-to-excel",
    title: "PDF to Excel",
    description: "Extract PDF text into worksheets, with columns inferred from layout.",
    category: "pdf",
    to: "/pdf/to-excel",
  },
  {
    id: "pdf-sign",
    title: "Sign PDF",
    description: "Draw or upload signatures and place them on PDF pages.",
    category: "pdf",
    to: "/pdf/sign",
  },
  {
    id: "pdf-annotate",
    title: "Page numbers & watermark",
    description: "Stamp page numbers or a text or logo watermark on selected pages.",
    category: "pdf",
    to: "/pdf/annotate",
  },
  {
    id: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Turn every sheet into a clean, printable PDF table.",
    category: "document",
    to: "/excel/to-pdf",
  },
  {
    id: "word-to-pdf",
    title: "Word to PDF",
    description: "Render DOCX documents to PDF in your browser.",
    category: "document",
    to: "/word/to-pdf",
  },
  {
    id: "markdown-to-word",
    title: "Markdown to Word",
    description: "Convert Markdown text or .md files into editable DOCX documents in your browser.",
    category: "document",
    to: "/markdown/to-word",
  },
  {
    id: "markdown-to-pdf",
    title: "Markdown to PDF",
    description:
      "Turn Markdown text or .md files into paginated, searchable PDF documents locally.",
    category: "document",
    to: "/markdown/to-pdf",
  },
  {
    id: "word-to-markdown",
    title: "Word to Markdown",
    description: "Extract headings, text, lists and simple tables from DOCX files into Markdown.",
    category: "document",
    to: "/word/to-markdown",
  },
  {
    id: "pdf-to-markdown",
    title: "PDF to Markdown",
    description: "Convert PDF pages to Markdown, including scanned pages with local OCR.",
    category: "pdf",
    to: ISOLATED_OCR_PATH,
  },
  {
    id: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "Render PPTX slides to PDF, with text, shapes, images, and tables.",
    category: "document",
    to: "/powerpoint/to-pdf",
  },
  {
    id: "video-to-mp3",
    title: "Video to MP3",
    description: "Extract audio from a video and save it as an MP3 file.",
    category: "media",
    to: "/media/video-to-mp3",
  },
  {
    id: "video-to-gif",
    title: "Video to GIF",
    description: "Turn a short video clip into an animated GIF in your browser.",
    category: "media",
    to: "/media/video-to-gif",
  },
  {
    id: "social-media-downloader",
    title: "YouTube, Instagram & Facebook downloader",
    description: "Download public YouTube, Instagram or Facebook videos, or extract their audio.",
    category: "media",
    to: "/media/social-downloader",
  },
]
