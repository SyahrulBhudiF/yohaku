import { MoonIcon, SunIcon } from "lucide-react"
import { useEffect } from "react"
import { flushSync } from "react-dom"

import { Button } from "@/components/ui/button"
import { useThemeStore } from "@/libs/stores/theme"

interface ThemeViewTransition {
  readonly finished: Promise<void>
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ThemeViewTransition
}

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  const syncTheme = useThemeStore((state) => state.syncTheme)
  const dark = theme === "dark"

  // architecture: external synchronization (theme DOM)
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")

    // Migrate the raw value written by the previous theme toggle to the
    // persisted store shape, so an existing choice survives the upgrade.
    try {
      const stored = localStorage.getItem("yohaku-theme")

      if (stored === "light" || stored === "dark") {
        localStorage.setItem(
          "yohaku-theme",
          JSON.stringify({ state: { theme: stored, chosen: true }, version: 0 }),
        )
      }
    } catch {
      // Storage can be unavailable in private browsing.
    }

    const followSystem = (event: MediaQueryListEvent) => {
      if (useThemeStore.getState().chosen) return

      document.documentElement.dataset.theme = event.matches ? "dark" : "light"
      syncTheme()
    }

    void useThemeStore.persist
      .rehydrate()
      .then(() => {
        const state = useThemeStore.getState()

        if (state.chosen) document.documentElement.dataset.theme = state.theme

        syncTheme()
      })
      .catch(() => syncTheme())

    media.addEventListener("change", followSystem)

    return () => media.removeEventListener("change", followSystem)
  }, [syncTheme])

  function handleToggleTheme() {
    const next = theme === "dark" ? "light" : "dark"
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const startViewTransition = (document as ThemeTransitionDocument).startViewTransition

    if (reduceMotion || !startViewTransition) {
      setTheme(next)

      return
    }

    try {
      const transition = startViewTransition.call(document, () => {
        flushSync(() => setTheme(next))
      })

      void transition.finished.catch(() => undefined)
    } catch {
      setTheme(next)
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
