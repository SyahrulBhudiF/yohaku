import { FileArchiveIcon, ImageUpIcon, RepeatIcon, type LucideIcon } from "lucide-react"

export interface ToolDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: LucideIcon
  readonly to: "/image/convert" | "/image/compress" | null
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
    id: "pdf",
    title: "PDF tools",
    description: "Merge, split, and convert Word, Excel and PDF files.",
    icon: FileArchiveIcon,
    to: null,
  },
]
