import type { ReactNode } from "react"

import { cn } from "@/libs/utils/cn"

interface InlineErrorProps {
  readonly children: ReactNode
  readonly className?: string
}

/** A consistent inline error banner for a failed action. */
export function InlineError({ children, className }: InlineErrorProps) {
  if (!children) return null

  return (
    <p
      role="alert"
      className={cn(
        "rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container",
        className,
      )}
    >
      {children}
    </p>
  )
}
