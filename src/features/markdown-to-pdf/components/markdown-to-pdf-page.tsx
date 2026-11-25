import { MarkdownConverterPage } from "@/features/document-tools/components/markdown-converter-page"
import { convertMarkdownToPdf } from "../process"
import { useMarkdownToPdfStore } from "../store"

export function MarkdownToPdfPage() {
  const store = useMarkdownToPdfStore()

  return (
    <MarkdownConverterPage
      {...store}
      id="markdown-to-pdf"
      japanese="MarkdownからPDFへ"
      title="Markdown to PDF"
      description="Turn Markdown text or a .md file into a paginated, searchable PDF in your browser."
      actionLabel="Convert to PDF"
      pendingLabel="Creating PDF…"
      convert={convertMarkdownToPdf}
    />
  )
}
