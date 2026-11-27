import { Link } from "@tanstack/react-router"

import { isIsolatedOcrPath, TOOLS } from "../registry"
import { toolSearchContent } from "../search-content"

export function ToolGuide({ pathname }: { pathname: string }) {
  const path = TOOLS.find((tool) => tool.to === pathname)?.to

  if (!path) return null

  const { guide, related } = toolSearchContent(path)

  return (
    <section
      aria-label="How it works"
      className="mx-auto mt-10 w-full max-w-3xl border-t border-outline-variant pt-6"
    >
      <h2 className="text-xl font-medium tracking-tight">How it works</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{guide}</p>
      <nav
        aria-label="Related tools"
        className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm"
      >
        <span className="font-medium">Related tools</span>
        {TOOLS.map(({ to, title }) =>
          to && related.includes(to) ? (
            <Link
              key={to}
              to={to}
              reloadDocument={isIsolatedOcrPath(path) || isIsolatedOcrPath(to)}
              className="text-primary underline underline-offset-4"
            >
              {title}
            </Link>
          ) : null,
        )}
      </nav>
    </section>
  )
}
