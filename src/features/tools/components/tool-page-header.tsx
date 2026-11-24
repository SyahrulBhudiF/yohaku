import type { ReactNode } from "react"

import { ToolPictogram } from "./tool-pictogram"

export function ToolPageHeader({
  id,
  japanese,
  children,
}: {
  id: string
  japanese: string
  children: ReactNode
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-outline-variant pb-5">
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        <p lang="ja" className="mt-1 text-sm text-muted-foreground">
          {japanese}
        </p>
      </div>
      <ToolPictogram id={id} className="size-16 shrink-0 sm:size-20" />
    </header>
  )
}
