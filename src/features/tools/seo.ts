import { TOOLS } from "./registry"
import { toolSearchContent } from "./search-content"

export const SITE_URL = "https://yohaku.ryuko.my.id"

export function pageSeo(pathname: string) {
  const tool = TOOLS.find((item) => item.to === pathname)
  const content = tool?.to ? toolSearchContent(tool.to) : undefined
  const title = content
    ? `${content.title} | Yohaku`
    : "Free Online PDF, Image & File Tools | Yohaku"
  const description =
    content?.description ??
    "Convert PDF pages to images, compress photos, merge PDFs and turn Office documents into PDFs. Explore Yohaku’s free browser-based file tools."
  const url = `${SITE_URL}${tool?.to ?? "/"}`
  const image = `${SITE_URL}/social/${tool?.id ?? "home"}.png`

  return { title, description, url, image, indexable: Boolean(tool) || pathname === "/" }
}
