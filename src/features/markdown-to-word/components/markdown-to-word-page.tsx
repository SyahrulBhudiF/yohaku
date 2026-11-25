import { MarkdownConverterPage } from "@/features/document-tools/components/markdown-converter-page"
import { useMarkdownToWordStore } from "../store"
import { convertMarkdownToWord } from "../process"

export function MarkdownToWordPage() {
  const store = useMarkdownToWordStore()

  return (
    <MarkdownConverterPage
      {...store}
      id="markdown-to-word"
      japanese="MarkdownからWordへ"
      title="Markdown to Word"
      description="Convert Markdown text or a .md file into an editable DOCX document in your browser."
      actionLabel="Convert to Word"
      pendingLabel="Creating Word document…"
      convert={convertMarkdownToWord}
    />
  )
}
