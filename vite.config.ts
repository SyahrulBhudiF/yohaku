import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Module workers loaded by an isolated document need an embedder policy too.
const assetHeaders = { "Cross-Origin-Embedder-Policy": "require-corp" }

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    allowedHosts: [".onamp.dev"],
    headers: assetHeaders,
  },
  preview: { headers: assetHeaders },
  optimizeDeps: {
    exclude: ["@jsquash/avif", "@jsquash/jpeg", "@jsquash/png", "@jsquash/webp"],
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
