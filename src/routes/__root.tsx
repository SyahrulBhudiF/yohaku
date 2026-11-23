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
        href: "/favicon.ico",
        sizes: "any",
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
    <>
      <header className="flex h-16 items-center bg-surface px-6">
        <Link to="/" className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <img src="/yohaku-icon.png" alt="" className="size-8 dark:invert" />
          Yohaku
        </Link>
        {pathname !== "/" && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            render={<Link to="/" />}
            nativeButton={false}
          >
            <ArrowLeftIcon /> All tools
          </Button>
        )}
      </header>
      <main className="px-6 pt-4 pb-16">
        <Outlet />
      </main>
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
