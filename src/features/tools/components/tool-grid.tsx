import { Link } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"
import { useState } from "react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/libs/utils/cn"
import { TOOLS, type ToolCategory, type ToolDefinition } from "../registry"

const SECTIONS: ReadonlyArray<{
  readonly id: ToolCategory
  readonly title: string
  readonly description: string
}> = [
  {
    id: "image",
    title: "Image tools",
    description: "Convert, compress, cut out, vectorize, and turn images into PDFs.",
  },
  {
    id: "pdf",
    title: "PDF tools",
    description: "Compress, merge, split, sign, convert, and render PDFs as images.",
  },
  {
    id: "document",
    title: "Document tools",
    description: "Convert Word documents and spreadsheets to PDF.",
  },
]

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon
  const card = (
    <Card
      className={cn(
        "h-full bg-surface-container-low shadow-none transition-shadow",
        tool.to ? "hover:shadow-elevation-2" : "opacity-60",
      )}
    >
      <CardHeader>
        <span className="mb-2 flex size-12 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          <Icon className="size-6" />
        </span>
        <CardTitle className="text-lg font-medium">{tool.title}</CardTitle>
        <CardDescription>
          {tool.to ? tool.description : `${tool.description} Coming soon.`}
        </CardDescription>
      </CardHeader>
    </Card>
  )

  return tool.to ? (
    <Link
      to={tool.to}
      className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  ) : (
    card
  )
}

export function ToolGrid() {
  const [query, setQuery] = useState("")
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = TOOLS.filter((tool) => {
    const text = `${tool.title} ${tool.description} ${tool.category}`.toLowerCase()

    return terms.every((term) => text.includes(term))
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">What do you want to do?</h1>
        <p className="text-muted-foreground">Everyday file tools in one place.</p>
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
          className="rounded-xl bg-surface-container-low pl-12"
        />
      </div>
      {matches.length === 0 && (
        <output className="text-sm text-muted-foreground">
          No tools found. Try a different search.
        </output>
      )}
      {SECTIONS.map((section) => {
        const tools = matches.filter((tool) => tool.category === section.id)

        if (tools.length === 0) return null

        return (
          <section key={section.id} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-medium">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
