import { assert, describe, it } from "@effect/vitest"
import { unzipSync } from "fflate"
import { beforeAll } from "vitest"

import { generateFavicons } from "@/features/favicon/process"
import { buildIco, buildWebManifest, fitImageOnSquare } from "@/libs/utils/favicon"
import { initImageCodecs, makePng } from "../../support/image-codecs"

beforeAll(initImageCodecs, 60_000)

describe("favicon helpers", () => {
  it("fits artwork inside a transparent square", () => {
    const source = new ImageData(new Uint8ClampedArray(4 * 2 * 4), 4, 2)

    for (let index = 0; index < source.data.length; index += 4) {
      source.data[index] = 255
      source.data[index + 3] = 255
    }

    const square = fitImageOnSquare(source, 4)

    assert.strictEqual(square.width, 4)
    assert.strictEqual(square.height, 4)
    assert.strictEqual(square.data[3], 0)
    assert.strictEqual(square.data[(1 * 4 + 1) * 4 + 3], 255)
  })

  it("builds an ICO directory with byte offsets", () => {
    const ico = buildIco([
      { size: 16, png: new Uint8Array([1, 2, 3]) },
      { size: 32, png: new Uint8Array([4, 5]) },
    ])
    const view = new DataView(ico.buffer)

    assert.strictEqual(view.getUint16(2, true), 1)
    assert.strictEqual(view.getUint16(4, true), 2)
    assert.strictEqual(view.getUint32(6 + 8, true), 3)
    assert.strictEqual(view.getUint32(6 + 12, true), 6 + 32)
    assert.strictEqual(view.getUint32(6 + 16 + 12, true), 6 + 32 + 3)
  })

  it("writes a manifest with both Android icons", () => {
    const manifest = JSON.parse(buildWebManifest("My app")) as {
      name: string
      icons: ReadonlyArray<{ sizes: string }>
    }

    assert.strictEqual(manifest.name, "My app")
    assert.deepEqual(
      manifest.icons.map((icon) => icon.sizes),
      ["192x192", "512x512"],
    )
  })
})

describe("generateFavicons", () => {
  it("creates the ICO, PNG sizes, manifest, snippet, and ZIP", async () => {
    const file = new File([await makePng(64, 48)], "logo.png", { type: "image/png" })
    const result = await generateFavicons(file)
    const zip = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
    const names = Object.keys(zip).sort()

    assert.include(names, "favicon.ico")
    assert.include(names, "favicon-16x16.png")
    assert.include(names, "favicon-32x32.png")
    assert.include(names, "favicon-48x48.png")
    assert.include(names, "apple-touch-icon.png")
    assert.include(names, "android-chrome-192x192.png")
    assert.include(names, "android-chrome-512x512.png")
    assert.include(names, "site.webmanifest")
    assert.include(names, "favicon-snippet.html")
    assert.deepEqual(Array.from(zip["favicon.ico"]!.slice(0, 4)), [0, 0, 1, 0])
    assert.deepEqual(
      Array.from(zip["favicon-16x16.png"]!.slice(0, 8)),
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    )
    assert.strictEqual(result.fileName, "logo-favicons.zip")
    assert.strictEqual(result.files.length, 9)
    assert.deepEqual(
      Array.from(new Uint8Array(await result.preview.arrayBuffer()).slice(0, 8)),
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    )
  })
})
