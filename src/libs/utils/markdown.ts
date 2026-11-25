export type MarkdownInline = {
  readonly text: string
  readonly bold?: boolean
  readonly italics?: boolean
  readonly code?: boolean
  readonly link?: string
}

export type MarkdownBlock =
  | {
      readonly type: "heading"
      readonly level: number
      readonly runs: ReadonlyArray<MarkdownInline>
    }
  | { readonly type: "paragraph" | "quote" | "code"; readonly runs: ReadonlyArray<MarkdownInline> }
  | {
      readonly type: "list"
      readonly ordered: boolean
      readonly runs: ReadonlyArray<MarkdownInline>
    }
  | { readonly type: "table"; readonly rows: ReadonlyArray<ReadonlyArray<string>> }
  | { readonly type: "rule" }

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

const escapeMarkdown = (value: string) =>
  value
    .replaceAll(/[\\`*_{}[\]|]/g, "\\$&")
    .replaceAll(/(^|\n)([ \t]*)(#{1,6}[ \t]|>[ \t]|[-+][ \t]|\d+[.)][ \t])/g, "$1$2\\$3")

export const parseMarkdownInline = (value: string): MarkdownInline[] => {
  const runs: MarkdownInline[] = []
  let cursor = 0

  for (const match of value.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0

    if (index > cursor) runs.push({ text: value.slice(cursor, index) })

    const token = match[0]

    if (token.startsWith("**") || token.startsWith("__")) {
      runs.push({ text: token.slice(2, -2), bold: true })
    } else if (token.startsWith("*") || token.startsWith("_")) {
      runs.push({ text: token.slice(1, -1), italics: true })
    } else if (token.startsWith("`")) {
      runs.push({ text: token.slice(1, -1), code: true })
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)

      if (link) runs.push({ text: link[1]!, link: link[2]! })
    }

    cursor = index + token.length
  }

  if (cursor < value.length) runs.push({ text: value.slice(cursor) })

  return runs
}

export const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n")
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!.trimEnd()

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.startsWith("```")) {
      const code: string[] = []

      index += 1

      while (index < lines.length && !lines[index]!.startsWith("```")) {
        code.push(lines[index]!)
        index += 1
      }

      blocks.push({ type: "code", runs: [{ text: code.join("\n") }] })
      index += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)

    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length,
        runs: parseMarkdownInline(heading[2]!),
      })
      index += 1
      continue
    }

    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ type: "rule" })
      index += 1
      continue
    }

    const list = line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/)

    if (list) {
      blocks.push({
        type: "list",
        ordered: Boolean(list[2]),
        runs: parseMarkdownInline(list[3]!),
      })
      index += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      blocks.push({ type: "quote", runs: parseMarkdownInline(line.replace(/^\s*>\s?/, "")) })
      index += 1
      continue
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}/.test(lines[index + 1]!)
    ) {
      const rows: string[][] = []

      while (index < lines.length && lines[index]!.includes("|")) {
        const cells = lines[index]!.trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim())

        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) rows.push(cells)
        index += 1
      }

      blocks.push({ type: "table", rows })
      continue
    }

    const paragraph = [line.trim()]

    index += 1

    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^(#{1,6})\s|^```|^\s*(?:[-+*]|\d+[.)])\s|^\s*>|^\s*(?:---+|___+|\*\*\*+)\s*$/.test(
        lines[index]!,
      )
    ) {
      paragraph.push(lines[index]!.trim())
      index += 1
    }

    blocks.push({ type: "paragraph", runs: parseMarkdownInline(paragraph.join(" ")) })
  }

  return blocks
}

export const markdownToPlainText = (markdown: string) =>
  parseMarkdown(markdown)
    .map((block) => {
      if ("runs" in block) return block.runs.map((run) => run.text).join("")
      if (block.type === "table") return block.rows.map((row) => row.join(" | ")).join("\n")

      return ""
    })
    .filter(Boolean)
    .join("\n")

export const escapeMarkdownText = escapeMarkdown
