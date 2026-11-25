import { spawnSync } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

const chrome = process.env.CHROME_BIN ?? "chromium"
const scratch = await mkdtemp(resolve(tmpdir(), "yohaku-seo-"))
const vite = await createServer({
  configFile: false,
  resolve: { alias: { "@": resolve("src") } },
  server: { middlewareMode: true },
  appType: "custom",
})

try {
  const { TOOLS } = await vite.ssrLoadModule("/src/features/tools/registry.ts")
  const { ToolPictogram } = await vite.ssrLoadModule(
    "/src/features/tools/components/tool-pictogram.tsx",
  )
  const { SITE_URL, pageSeo } = await vite.ssrLoadModule("/src/features/tools/seo.ts")
  const hostname = new URL(SITE_URL).hostname
  const tools = TOOLS.filter((tool) => tool.to)
  const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  const stylesheet = await readFile("src/styles.css", "utf8")
  const lightTheme = stylesheet.match(/^:root \{[^}]*\}/m)?.[0]
  const font = await readFile(
    "node_modules/@fontsource-variable/roboto-flex/files/roboto-flex-latin-wght-normal.woff2",
    "base64",
  )
  const logo = `data:image/png;base64,${await readFile("public/yohaku-icon.png", "base64")}`

  if (!lightTheme) throw new Error("Could not find Yohaku's light theme in src/styles.css")

  await mkdir("public/social", { recursive: true })

  for (const tool of [
    {
      id: "home",
      title: "Everyday tools.",
      category: "file",
      description: pageSeo("/").description,
    },
    ...tools,
  ]) {
    const art =
      tool.id === "home"
        ? `<img class="hero-mark" src="${logo}" alt="">`
        : renderToStaticMarkup(React.createElement(ToolPictogram, { id: tool.id }))
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>
      ${lightTheme}
      @font-face { font-family: "Roboto Flex Variable"; src: url(data:font/woff2;base64,${font}); font-weight: 100 1000; }
      * { box-sizing: border-box; }
      body { margin: 0; width: 1200px; height: 630px; padding: 48px 60px;
        background: var(--md-surface); color: var(--md-on-surface);
        font-family: "Roboto Flex Variable", system-ui, sans-serif; }
      header, footer { display: flex; align-items: center; gap: 12px; }
      header { height: 58px; padding-bottom: 16px; border-bottom: 1px solid var(--md-outline-variant); }
      header img { width: 38px; height: 38px; }
      header strong { font-size: 31px; font-weight: 500; letter-spacing: -.035em; }
      header span { font: 400 20px "Noto Sans CJK JP", sans-serif; color: var(--md-on-surface-variant); }
      main { display: grid; grid-template-columns: minmax(0, 1fr) 300px; align-items: center; gap: 30px;
        height: 394px; margin-top: 22px; padding: 34px; border: 1px solid var(--md-outline-variant);
        border-radius: var(--radius); background: var(--md-surface-container-low); }
      .category { display: inline-block; padding: 6px 13px; border-radius: var(--radius);
        background: var(--md-secondary-container); color: var(--md-on-secondary-container);
        font-size: 19px; text-transform: capitalize; }
      h1 { margin: 16px 0 12px; font-size: 64px; line-height: 1.03; font-weight: 600;
        letter-spacing: -.042em; text-wrap: balance; }
      .long-title { font-size: 52px; }
      p { max-width: 570px; margin: 0; font-size: 26px; line-height: 1.35;
        color: var(--md-on-surface-variant); }
      .art { display: grid; place-items: center; aspect-ratio: 1; border-radius: var(--radius);
        background: var(--md-surface-container); }
      .art svg { width: 262px; height: 262px; }
      .hero-mark { width: 178px; height: 178px; }
      footer { justify-content: space-between; margin-top: 22px;
        font-size: 20px; color: var(--md-on-surface-variant); }
      footer span:first-child { display: flex; align-items: center; gap: 10px; }
      footer span:first-child::before { content: ""; width: 16px; height: 2px; background: var(--yohaku-sage); }
    </style><body>
      <header><img src="${logo}" alt=""><strong>Yohaku</strong><span lang="ja">余白</span></header>
      <main><section>
        <span class="category">${tool.category === "pdf" ? "PDF" : tool.category} tools</span>
        <h1${tool.title.length > 30 ? ' class="long-title"' : ""}>${escape(tool.title)}</h1>
        <p>${escape(tool.description)}</p>
      </section><div class="art">${art}</div></main>
      <footer><span>A little space for useful things.</span><span>${hostname}</span></footer>
    </body></html>`
    const source = resolve(scratch, "card.html")
    const png = resolve(scratch, `${tool.id}.png`)

    await writeFile(source, html)

    const result = spawnSync(
      chrome,
      [
        "--headless",
        "--hide-scrollbars",
        "--no-first-run",
        "--force-device-scale-factor=1",
        "--window-size=1200,630",
        `--user-data-dir=${resolve(scratch, "chrome")}`,
        "--virtual-time-budget=1000",
        `--screenshot=${png}`,
        pathToFileURL(source).href,
      ],
      { encoding: "utf8" },
    )

    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(result.stderr)

    await copyFile(png, resolve("public/social", `${tool.id}.png`))
  }

  const entries = ["/", ...tools.map((tool) => tool.to)]
    .map((path) => `  <url><loc>${pageSeo(path).url}</loc></url>`)
    .join("\n")

  await writeFile(
    "public/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
  )
} finally {
  await vite.close()
  await rm(scratch, { recursive: true, force: true })
}
