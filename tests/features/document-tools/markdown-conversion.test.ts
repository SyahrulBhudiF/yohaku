import { Packer } from "docx"
import { zipSync, strToU8 } from "fflate"
import { describe, expect, it } from "vitest"

import { createMarkdownDocument } from "@/features/markdown-to-word/document"
import { extractMarkdownFromDocx } from "@/features/word-to-markdown/document"
import { markdownToPlainText, parseMarkdown } from "@/libs/utils/markdown"

describe("Markdown document conversion", () => {
  it("parses common Markdown blocks and inline formatting", () => {
    const source = [
      "# A heading",
      "",
      "A **bold** and *italic* sentence with a [link](https://example.com).",
      "",
      "- first item",
      "- second item",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| paper | 12 |",
      "",
      "```txt",
      "code sample",
      "```",
    ].join("\n")
    const blocks = parseMarkdown(source)

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "table",
      "code",
    ])
    expect(blocks[1]).toMatchObject({
      runs: [
        { text: "A " },
        { text: "bold", bold: true },
        { text: " and " },
        { text: "italic", italics: true },
        { text: " sentence with a " },
        { text: "link", link: "https://example.com" },
        { text: "." },
      ],
    })
    expect(markdownToPlainText(source)).toContain("paper | 12")
    expect(markdownToPlainText(source)).toContain("code sample")
  })

  it("round-trips headings, emphasis, lists, tables and code through DOCX", async () => {
    const source = [
      "# Conversion notes",
      "",
      "Keep **important** details and *small* notes for round-trip validation.",
      "",
      "- first item",
      "- second item",
      "",
      "| Format | Result |",
      "| --- | --- |",
      "| Markdown | DOCX |",
      "",
      "```",
      "const value = 1",
      "```",
    ].join("\n")
    const blob = await Packer.toBlob(createMarkdownDocument(source))
    const markdown = extractMarkdownFromDocx(new Uint8Array(await blob.arrayBuffer()))

    expect(markdown).toContain("# Conversion notes")
    expect(markdown).toContain("**important**")
    expect(markdown).toContain("*small*")
    expect(markdown).toContain("round-trip validation.")
    expect(markdown).toContain("- first item")
    expect(markdown).toContain("| Format | Result |")
    expect(markdown).toContain("const value = 1")
  })

  it("extracts the document XML without expanding unrelated package entries", () => {
    const documentXml = strToU8(
      "<w:document><w:body><w:p><w:r><w:t>Readable text</w:t></w:r></w:p></w:body></w:document>",
    )
    const archive = zipSync({
      "word/document.xml": documentXml,
      "word/media/image1.png": new Uint8Array(1024),
    })

    expect(extractMarkdownFromDocx(archive)).toBe("Readable text")
  })
})
