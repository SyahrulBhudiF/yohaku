import {
  FileImageIcon,
  FilePlus2Icon,
  FileDownIcon,
  FileSpreadsheetIcon,
  FilesIcon,
  ImageUpIcon,
  PenLineIcon,
  RepeatIcon,
  ScissorsIcon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react"

export type ToolCategory = "image" | "pdf" | "document"

export interface ToolDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: LucideIcon
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
    | "/pdf/to-image"
    | "/pdf/sign"
    | "/excel/to-pdf"
    | null
}

/** Add new tools here. `to: null` renders a "coming soon" card. */
export const TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    id: "image-convert",
    title: "Convert image",
    description: "Switch between PNG, JPEG, WebP, AVIF, GIF and TIFF, or trace to SVG.",
    icon: RepeatIcon,
    category: "image",
    to: "/image/convert",
  },
  {
    id: "image-compress",
    title: "Compress image",
    description: "Shrink file size and see how much you saved.",
    icon: ImageUpIcon,
    category: "image",
    to: "/image/compress",
  },
  {
    id: "image-to-pdf",
    title: "Image to PDF",
    description: "Combine images into one PDF, or make one PDF per image.",
    icon: FilePlus2Icon,
    category: "image",
    to: "/image/to-pdf",
  },
  {
    id: "image-remove-background",
    title: "Remove background",
    description: "Cut out the subject and download a transparent PNG.",
    icon: WandSparklesIcon,
    category: "image",
    to: "/image/remove-background",
  },
  {
    id: "pdf-merge",
    title: "Merge PDF",
    description: "Combine PDFs and reorder pages with drag and drop.",
    icon: FilesIcon,
    category: "pdf",
    to: "/pdf/merge",
  },
  {
    id: "pdf-compress",
    title: "Compress PDF",
    description: "Reduce PDF file size with lossless optimization, in your browser.",
    icon: FileDownIcon,
    category: "pdf",
    to: "/pdf/compress",
  },
  {
    id: "pdf-extract",
    title: "Extract PDF pages",
    description: "Keep selected pages and save them as a new PDF.",
    icon: ScissorsIcon,
    category: "pdf",
    to: "/pdf/extract",
  },
  {
    id: "pdf-split",
    title: "Split PDF",
    description: "Split by page ranges and download the results as a ZIP.",
    icon: ScissorsIcon,
    category: "pdf",
    to: "/pdf/split",
  },
  {
    id: "pdf-to-image",
    title: "PDF to image",
    description: "Render every PDF page as a PNG, JPEG, WebP, AVIF, GIF or TIFF.",
    icon: FileImageIcon,
    category: "pdf",
    to: "/pdf/to-image",
  },
  {
    id: "pdf-sign",
    title: "Sign PDF",
    description: "Draw or upload signatures and place them on PDF pages.",
    icon: PenLineIcon,
    category: "pdf",
    to: "/pdf/sign",
  },
  {
    id: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Turn every sheet into a clean, printable PDF table.",
    icon: FileSpreadsheetIcon,
    category: "document",
    to: "/excel/to-pdf",
  },
]
