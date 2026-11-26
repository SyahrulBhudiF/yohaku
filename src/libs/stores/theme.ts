import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "light" | "dark"

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
}

interface ThemeState {
  readonly theme: Theme
  readonly chosen: boolean
  readonly setTheme: (theme: Theme) => void
  readonly syncTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      chosen: false,
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme, chosen: true })
      },
      syncTheme: () => {
        const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light"

        if (get().theme === theme) return

        set({ theme })
      },
    }),
    {
      name: "yohaku-theme",
      partialize: (state) => ({ theme: state.theme, chosen: state.chosen }),
      skipHydration: true,
    },
  ),
)
