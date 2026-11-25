import { readFileSync } from "node:fs"

import { assert, describe, it } from "@effect/vitest"

import { TOOLS } from "@/features/tools/registry"
import { pageSeo, SITE_URL } from "@/features/tools/seo"

describe("tool search metadata", () => {
  it("provides a unique indexed page and PNG preview for every available tool", () => {
    const sitemap = readFileSync("public/sitemap.xml", "utf8")
    const home = pageSeo("/")
    const titles = new Set([home.title])
    const descriptions = new Set([home.description])
    const images = new Set<string>()

    for (const tool of TOOLS) {
      if (!tool.to) continue

      const seo = pageSeo(tool.to)
      const png = readFileSync(`public/social/${tool.id}.png`)

      assert.isTrue(seo.indexable)
      assert.strictEqual(seo.url, `${SITE_URL}${tool.to}`)
      assert.isNotEmpty(seo.description)
      assert.include(sitemap, `<loc>${seo.url}</loc>`)
      assert.strictEqual(png.readUInt32BE(16), 1200)
      assert.strictEqual(png.readUInt32BE(20), 630)
      titles.add(seo.title)
      descriptions.add(seo.description)
      images.add(seo.image)
    }

    const toolCount = TOOLS.filter((tool) => tool.to).length

    assert.strictEqual(images.size, toolCount)
    assert.strictEqual(titles.size, toolCount + 1)
    assert.strictEqual(descriptions.size, toolCount + 1)
    assert.isFalse(pageSeo("/not-a-page").indexable)
  })
})
