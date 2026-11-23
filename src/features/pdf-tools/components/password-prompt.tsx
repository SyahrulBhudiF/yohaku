import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatBytes } from "@/libs/utils/format"

interface PasswordPromptProps {
  readonly name: string
  readonly size: number
  readonly message: string
  readonly busy: boolean
  readonly onUnlock: (password: string) => void
  readonly onRemove: () => void
}

export function PasswordPrompt({
  name,
  size,
  message,
  busy,
  onUnlock,
  onRemove,
}: PasswordPromptProps) {
  const id = useId()
  const [password, setPassword] = useState("")

  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 ring-1 ring-outline-variant"
      onSubmit={(event) => {
        event.preventDefault()
        onUnlock(password)
      }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(size)} · password-protected
        </span>
      </div>
      <p role="alert" className="text-sm text-on-surface-variant">
        {message}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">
          Password for {name}
        </label>
        <Input
          id={id}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="PDF password"
          className="h-10 sm:flex-1"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy || password.length === 0}>
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
            Remove
          </Button>
        </div>
      </div>
    </form>
  )
}
