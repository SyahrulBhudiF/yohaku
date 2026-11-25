import { MoonIcon, SunIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  const chosen = useRef(false)

  // architecture: external synchronization (theme DOM)
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => setDark(document.documentElement.dataset.theme === "dark")

    try {
      const stored = localStorage.getItem("yohaku-theme")

      chosen.current = stored === "light" || stored === "dark"
    } catch {
      // Storage can be unavailable in private browsing.
    }

    const followSystem = (event: MediaQueryListEvent) => {
      if (chosen.current) return

      document.documentElement.dataset.theme = event.matches ? "dark" : "light"
      sync()
    }

    sync()
    media.addEventListener("change", followSystem)

    return () => media.removeEventListener("change", followSystem)
  }, [])

  function handleToggleTheme() {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"

    chosen.current = true
    document.documentElement.dataset.theme = theme
    setDark(theme === "dark")

    try {
      localStorage.setItem("yohaku-theme", theme)
    } catch {
      // The selected theme still applies for this visit.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Dark mode"
      aria-pressed={dark}
      onClick={handleToggleTheme}
    >
      <MoonIcon aria-hidden="true" className="dark:hidden" />
      <SunIcon aria-hidden="true" className="hidden dark:block" />
    </Button>
  )
}
