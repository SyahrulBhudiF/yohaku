import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { ArrowLeftIcon } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Yohaku",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/yohaku-icon.png",
        sizes: "512x512",
      },
      {
        rel: "shortcut icon",
        href: "/yohaku-icon.png",
        type: "image/png",
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  component: AppShell,
  shellComponent: RootDocument,
})

function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-[calc(100%-3rem)] max-w-5xl shrink-0 items-center border-b border-outline-variant bg-surface">
        <Link to="/" className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <img src="/yohaku-icon.png" alt="" className="size-8 dark:invert" />
          Yohaku{" "}
          <span lang="ja" className="text-sm font-normal text-muted-foreground">
            余白
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {pathname !== "/" && (
            <Button variant="ghost" size="sm" render={<Link to="/" />} nativeButton={false}>
              <ArrowLeftIcon /> All tools
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 px-6 pt-4 pb-16">
        <Outlet />
      </main>
      <footer className="mx-auto flex w-[calc(100%-3rem)] max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-outline-variant py-5 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <img src="/yohaku-icon.png" alt="" width={20} height={20} className="dark:invert" />
            Yohaku{" "}
            <span lang="ja" className="font-normal text-muted-foreground">
              余白
            </span>
          </span>
          <span>A little space for useful things.</span>
        </div>
        <a href="https://github.com/SyahrulBhudiF/yohaku" className="underline underline-offset-4">
          GitHub
        </a>
      </footer>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { var theme = localStorage.getItem("yohaku-theme"); } catch (e) {} document.documentElement.dataset.theme = theme === "light" || theme === "dark" ? theme : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
