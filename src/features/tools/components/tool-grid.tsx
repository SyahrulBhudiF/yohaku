import { Link } from "@tanstack/react-router"
import { ArrowUpRightIcon, SearchIcon } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/libs/utils/cn"
import { ISOLATED_OCR_PATH, TOOLS, type ToolCategory, type ToolDefinition } from "../registry"
import { ToolPictogram } from "./tool-pictogram"

const SECTIONS: ReadonlyArray<{
  readonly id: ToolCategory
  readonly title: string
  readonly label: string
  readonly japanese: string
  readonly description: string
}> = [
  {
    id: "image",
    title: "Image tools",
    label: "Image",
    japanese: "画像",
    description: "Convert, compress, cut out, vectorize, and turn images into PDFs.",
  },
  {
    id: "pdf",
    title: "PDF tools",
    label: "PDF",
    japanese: "PDF",
    description:
      "Work with PDF files: organize, protect, annotate, sign, extract, or convert them.",
  },
  {
    id: "document",
    title: "Document tools",
    label: "Document",
    japanese: "文書",
    description:
      "Convert Markdown, Word documents, spreadsheets, and presentations to other formats.",
  },
  {
    id: "media",
    title: "Media tools",
    label: "Media",
    japanese: "メディア",
    description: "Download public videos, extract MP3 audio, or convert local media.",
  },
]

const CATEGORY_ITEMS: ReadonlyArray<{
  readonly id: ToolCategory | "all"
  readonly label: string
  readonly japanese: string
}> = [
  { id: "all", label: "All", japanese: "すべて" },
  ...SECTIONS.map(({ id, label, japanese }) => ({ id, label, japanese })),
]

const JAPANESE_TITLES: Record<string, string> = {
  "image-convert": "画像の変換",
  "image-compress": "画像の圧縮",
  "image-batch-compress": "画像の一括圧縮",
  "image-to-pdf": "画像からPDFへ",
  "image-remove-background": "背景除去",
  "pdf-merge": "PDFの結合",
  "pdf-compress": "PDFの圧縮",
  "pdf-extract": "PDFページの抽出",
  "pdf-split": "PDFの分割",
  "pdf-reorganize": "PDFページの整理",
  "pdf-protect": "PDFの保護と解除",
  "pdf-to-image": "PDFから画像へ",
  "pdf-to-word": "PDFからWordへ",
  "pdf-to-excel": "PDFからExcelへ",
  "pdf-sign": "PDFに署名",
  "pdf-annotate": "ページ番号と透かし",
  "excel-to-pdf": "ExcelからPDFへ",
  "word-to-pdf": "WordからPDFへ",
  "powerpoint-to-pdf": "PowerPointからPDFへ",
  "markdown-to-word": "MarkdownからWordへ",
  "markdown-to-pdf": "MarkdownからPDFへ",
  "word-to-markdown": "WordからMarkdownへ",
  "pdf-to-markdown": "PDFからMarkdownへ",
  "video-to-mp3": "音声の抽出",
  "social-media-downloader": "動画のダウンロード",
}

function ToolCard({
  tool,
  japanese,
  categoryLabel,
}: {
  tool: ToolDefinition
  japanese: string
  categoryLabel: string
}) {
  const card = (
    <article
      className={cn(
        "relative flex h-full min-h-40 items-center gap-4 rounded-md border border-outline-variant bg-card p-4 transition-colors motion-reduce:transition-none",
        tool.to ? "hover:bg-surface-container" : "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1 self-start">
        <span className="mb-2 inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          <span lang="ja">{japanese}</span>
          {japanese !== categoryLabel && (
            <>
              <span aria-hidden="true" className="mx-1.5">
                /
              </span>
              {categoryLabel}
            </>
          )}
        </span>
        <h3 className="text-base leading-snug font-medium">{tool.title}</h3>
        <p lang="ja" className="mt-0.5 text-xs text-muted-foreground">
          {JAPANESE_TITLES[tool.id]}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {tool.to ? tool.description : `${tool.description} Coming soon.`}
        </p>
      </div>
      <ToolPictogram id={tool.id} className="mr-2 size-20 shrink-0 sm:size-24" />
      {tool.to && (
        <ArrowUpRightIcon
          aria-hidden="true"
          className="absolute right-3 bottom-3 size-4 text-muted-foreground"
        />
      )}
    </article>
  )

  return tool.to ? (
    <Link
      to={tool.to}
      reloadDocument={tool.to === ISOLATED_OCR_PATH}
      aria-label={tool.title}
      className="tool-card-link rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  ) : (
    card
  )
}

export function ToolGrid() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<ToolCategory | "all">("all")
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = TOOLS.filter((tool) => {
    const text = `${tool.title} ${tool.description} ${tool.category}`.toLowerCase()

    return (
      (category === "all" || tool.category === category) &&
      terms.every((term) => text.includes(term))
    )
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="relative isolate flex min-h-44 items-center overflow-hidden py-4 sm:aspect-3/1 sm:min-h-48 sm:py-8">
        <svg
          aria-hidden="true"
          viewBox="0 0 510 200"
          preserveAspectRatio="xMaxYMid meet"
          className="pointer-events-none absolute -right-8 bottom-0 -z-10 h-full w-64 sm:right-0 sm:w-[85%]"
        >
          <defs>
            <radialGradient id="hero-halo" cx="50%" cy="15%" r="85%">
              <stop stopColor="var(--yohaku-sand)" stopOpacity=".19" />
              <stop offset="1" stopColor="var(--yohaku-sand)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hero-hills" x2="0" y2="1">
              <stop stopColor="var(--yohaku-sage)" stopOpacity=".46" />
              <stop offset="1" stopColor="var(--yohaku-sage)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hero-ink-wash" x2=".3" y2="1">
              <stop stopColor="var(--yohaku-sage)" stopOpacity=".65" />
              <stop offset="1" stopColor="var(--yohaku-ink)" />
            </linearGradient>
            <linearGradient id="hero-sage-wash" x2=".6" y2="1">
              <stop stopColor="var(--yohaku-sage)" />
              <stop offset="1" stopColor="var(--yohaku-ink)" />
            </linearGradient>
          </defs>
          <circle cx="386" cy="116" r="110" fill="url(#hero-halo)" />
          <path
            d="M0 191c37-4 53-7 80-16 17-6 34-1 47-6 9-3 16 1 22 2 9-2 26-13 38-12 13 1 26 7 42 11 12-3 22-11 36-9 21 3 37 22 79 30Z"
            fill="url(#hero-hills)"
            className="hidden sm:block"
          />
          <path
            d="M125 195c44-6 59-13 80-14 18-1 26-8 43-5 21 4 52 14 83 19Z"
            fill="url(#hero-hills)"
            className="hidden sm:block"
          />
          <g transform="translate(279 40) scale(1.15)">
            <path d="M0 0h58v58H0z" fill="url(#hero-ink-wash)" />
            <path d="M0 58 58 0v58z" fill="var(--yohaku-sage)" />
            <circle cx="91" cy="29" r="29" fill="var(--yohaku-sand)" />
            <path d="M91 0a29 29 0 0 0 0 58z" fill="url(#hero-sage-wash)" />
            <path d="M0 62h58v58H0z" fill="var(--yohaku-sand)" />
            <path d="M0 120 58 62v58z" fill="var(--yohaku-sage)" />
            <path d="M62 62h58v58H62z" fill="var(--yohaku-ink)" />
            <circle cx="91" cy="91" r="20" fill="var(--yohaku-paper)" />
          </g>
          <g className="hidden text-[var(--yohaku-sage)] sm:block">
            <path
              d="M482-5c-18 9-24 28-32 41-8 13-8 28-17 52m28-71c-12 8-19 10-35 12m28 0c-13 8-20 12-30 25m22-4c-11 6-18 13-28 19m33-29c8 9 11 17 20 24m-12-38c10 6 16 14 23 24m-17-36c13 1 23 6 32 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M461 17c-11 0-19 2-24 8 12-2 17-4 24-8Zm-17 10c-10-4-19-2-27 1 12 2 19 3 27-1Zm-3 10c-12 1-19 8-25 14 12-4 19-8 25-14Zm-11 10c-8 2-12 7-16 13 8-3 13-6 16-13Zm8 9c-12 3-18 9-24 18 11-6 19-11 24-18Zm0 15c-7 8-8 17-7 26 5-10 8-18 7-26Zm6-19c-1 10 1 17 6 25 1-10-1-17-6-25Zm13-5c2 9 8 15 15 19-4-9-7-15-15-19Zm1-15c-1 8 0 14 4 20 2-7 1-14-4-20Zm14 5c1 9 5 14 12 19-3-9-6-15-12-19Zm-5-24c-5 10-4 15-2 21 5-9 5-15 2-21Zm13 4c4-7 10-9 16-8-6 1-7 6-16 8Zm7 4c1 9 5 14 11 19-2-9-5-16-11-19Z"
              fill="currentColor"
            />
          </g>
        </svg>
        <div className="flex w-[65%] flex-col gap-2 sm:w-[57%] sm:-translate-y-2 lg:-translate-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Everyday tools.
          </h1>
          <p lang="ja" className="text-sm text-muted-foreground lg:text-xl">
            日々のツール{" "}
            <span
              aria-hidden="true"
              className="ml-2 inline-block w-10 align-middle border-t border-outline"
            />
          </p>
          <p className="mt-2 text-sm text-muted-foreground lg:text-base">
            Convert PDFs to images, compress photos, and turn Office documents into PDFs with free
            browser-based tools.
          </p>
          <p lang="ja" className="text-xs text-muted-foreground lg:text-sm">
            画像・文書・メディアなど、日々の作業を少しだけ軽くするツールです。
          </p>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 border-t border-outline-variant"
        />
      </div>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search tools"
          placeholder="Search tools"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-md bg-surface-container-low pl-12"
        />
      </div>
      <nav
        aria-label="Tool categories"
        className="flex flex-wrap items-start gap-x-8 gap-y-4 border-t border-outline-variant pt-4 sm:justify-between sm:gap-x-6"
      >
        {CATEGORY_ITEMS.map((item) => {
          const active = category === item.id

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(item.id)}
              className="group flex flex-col items-start gap-1.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <span
                lang="ja"
                className={cn(
                  "text-[0.6875rem] leading-none tracking-wide transition-colors",
                  active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {item.japanese}
              </span>
              <span
                className={cn(
                  "border-b-2 pb-1 text-sm leading-none font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground group-hover:text-foreground",
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
      {matches.length === 0 && (
        <output className="text-sm text-muted-foreground">
          No tools found. Try a different search.
        </output>
      )}
      {SECTIONS.map((section, sectionIndex) => {
        const tools = matches.filter((tool) => tool.category === section.id)

        if (tools.length === 0) return null

        return (
          <section key={section.id} className="flex flex-col gap-4">
            <div className="border-t border-outline-variant pt-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {String(sectionIndex + 1).padStart(2, "0")}
                </span>
                <h2 className="text-xl font-medium">{section.title}</h2>
                <span lang="ja" className="text-sm text-muted-foreground">
                  {section.japanese}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {String(tools.length).padStart(2, "0")} utilities
                </span>
              </div>
              <div className="mt-3 border-t border-outline-variant pt-3">
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  japanese={section.japanese}
                  categoryLabel={section.label}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
