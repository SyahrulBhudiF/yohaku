import { FileUpIcon } from "lucide-react"

import { Dropzone } from "@/components/dropzone"

export function MarkdownEditor({
  value,
  onChange,
  onFile,
  disabled,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onFile: (file: File | undefined) => void
  readonly disabled: boolean
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="markdown-source" className="text-sm font-medium">
          Markdown source
        </label>
      </div>
      <Dropzone
        icon={FileUpIcon}
        accept=".md,.markdown,text/markdown,text/plain"
        compact
        disabled={disabled}
        label="Open a Markdown file"
        hint="MD or Markdown · replaces the editor content"
        onFiles={(files) => onFile(files[0])}
      />
      <textarea
        id="markdown-source"
        aria-label="Markdown source"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={"# A little space\n\nWrite or paste Markdown here…"}
        className="min-h-80 w-full resize-y rounded-xl border border-outline bg-surface-container-low p-4 font-mono text-sm leading-6 text-on-surface outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
      />
      <p className="text-xs text-muted-foreground">
        Supports headings, paragraphs, emphasis, links, lists, quotes, code blocks and simple
        tables. Your text stays in this browser.
      </p>
    </section>
  )
}
