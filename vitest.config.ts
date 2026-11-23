import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        inline: ["wasm-webp"],
      },
    },
    benchmark: { include: ["tests/**/*.bench.ts"] },
  },
})
