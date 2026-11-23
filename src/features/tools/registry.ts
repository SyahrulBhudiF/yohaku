import { FilesIcon, ImageUpIcon, RepeatIcon, ScissorsIcon, type LucideIcon } from "lucide-react"

export interface ToolDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: LucideIcon
  readonly to: "/image/convert" | "/image/compress" | "/pdf/merge" | "/pdf/split" | null
}

/** Add new tools here. `to: null` renders a "coming soon" card. */
export const TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    id: "image-convert",
    title: "Convert image",
    description: "Switch between PNG, JPEG, WebP, AVIF, GIF and TIFF.",
    icon: RepeatIcon,
    to: "/image/convert",
  },
  {
    id: "image-compress",
    title: "Compress image",
    description: "Shrink file size and see how much you saved.",
    icon: ImageUpIcon,
    to: "/image/compress",
  },
  {
    id: "pdf-merge",
    title: "Merge PDF",
    description: "Combine PDFs and reorder pages with drag and drop.",
    icon: FilesIcon,
    to: "/pdf/merge",
  },
  {
    id: "pdf-split",
    title: "Split PDF",
    description: "Split by page ranges and download the results as a ZIP.",
    icon: ScissorsIcon,
    to: "/pdf/split",
  },
]
