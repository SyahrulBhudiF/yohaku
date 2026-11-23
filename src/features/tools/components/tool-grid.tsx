import { Link } from "@tanstack/react-router"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    description: "Convert, compress, and turn images into PDFs.",
  },
  {
    id: "pdf",
    title: "PDF tools",
    description: "Merge, split, and render PDFs as images.",
  },
  {
    id: "document",
    title: "Document tools",
    description: "Turn spreadsheets into clean PDFs.",
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
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">What do you want to do?</h1>
        <p className="text-muted-foreground">Everyday file tools in one place.</p>
      </div>
      {SECTIONS.map((section) => {
        const tools = TOOLS.filter((tool) => tool.category === section.id)

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
