import { strFromU8, unzipSync } from "fflate"

import { MAX_DOCX_DOCUMENT_XML_BYTES } from "@/libs/schemas/document"
import { escapeMarkdownText } from "@/libs/utils/markdown"

const decodeXml = (value: string) =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replaceAll(/&#x([\da-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )

const markdownForRun = (xml: string) => {
  const properties = xml.match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/)?.[1] ?? ""
  const text = [
    ...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>/g),
  ]
    .map((match) => {
      if (match[1] !== undefined) return decodeXml(match[1])
      if (match[0].startsWith("<w:tab")) return "\t"

      return "\n"
    })
    .join("")

  if (!text) return ""

  const escaped = escapeMarkdownText(text)
  const bold = /<w:b(?:\s|\/|>)/.test(properties)
  const italics = /<w:i(?:\s|\/|>)/.test(properties)
  const code = /Consolas|Courier/i.test(properties)

  if (code) return `\`${escaped}\``
  if (bold && italics) return `***${escaped}***`
  if (bold) return `**${escaped}**`
  if (italics) return `*${escaped}*`

  return escaped
}

const markdownForParagraph = (xml: string) => {
  const runs = [...xml.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].map((match) =>
    markdownForRun(match[0]),
  )
  const text = runs.join("").trim()

  if (!text) return ""

  const heading = xml.match(/<w:pStyle\b[^>]*w:val="(?:Heading|heading)([1-6])"/)

  if (heading) return `${"#".repeat(Number(heading[1]))} ${text}`
  if (/<w:numPr\b/.test(xml)) return `- ${text}`

  return text
}

const markdownForTable = (xml: string) => {
  const rows = [...xml.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map((row) =>
    [...row[1]!.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)].map((cell) =>
      [...cell[1]!.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
        .map((paragraph) => markdownForParagraph(paragraph[0]))
        .filter(Boolean)
        .join(" "),
    ),
  )

  if (rows.length === 0) return ""

  const width = Math.max(...rows.map((row) => row.length))
  const line = (row: ReadonlyArray<string>) =>
    `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`

  return [
    line(rows[0]!),
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...rows.slice(1).map(line),
  ].join("\n")
}

export const extractMarkdownFromDocx = (bytes: Uint8Array) => {
  const files = unzipSync(bytes, {
    filter: ({ name, originalSize }) =>
      name === "word/document.xml" && originalSize <= MAX_DOCX_DOCUMENT_XML_BYTES,
  })
  const document = files["word/document.xml"]

  if (!document) return null

  const xml = strFromU8(document)
  const body = xml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/)?.[1]

  if (!body) return null

  const blocks: string[] = []
  const blockPattern = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g

  for (const match of body.matchAll(blockPattern)) {
    const block = match[0]
    const text = block.startsWith("<w:tbl") ? markdownForTable(block) : markdownForParagraph(block)

    if (text) blocks.push(text)
  }

  if (blocks.length === 0) return null

  return blocks.join("\n\n")
}
