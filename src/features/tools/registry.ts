export type ToolCategory = "image" | "pdf" | "document" | "media"

export interface ToolDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly category: ToolCategory
  readonly to:
    | "/image/convert"
    | "/image/compress"
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
    | "/excel/to-pdf"
    | "/word/to-pdf"
    | "/media/video-to-mp3"
    | "/media/social-downloader"
    | null
}

/** Add new tools here. `to: null` renders a "coming soon" card. */
export const TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    id: "image-convert",
    title: "Convert image",
    description: "Switch between PNG, JPEG, WebP, AVIF, GIF and TIFF, or trace to SVG.",
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
    id: "image-to-pdf",
    title: "Image to PDF",
    description: "Combine images into one PDF, or make one PDF per image.",
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
    id: "video-to-mp3",
    title: "Video to MP3",
    description: "Extract audio from a video and save it as an MP3 file.",
    category: "media",
    to: "/media/video-to-mp3",
  },
  {
    id: "social-media-downloader",
    title: "YouTube & Instagram downloader",
    description: "Download public videos or extract their audio as MP3.",
    category: "media",
    to: "/media/social-downloader",
  },
]
