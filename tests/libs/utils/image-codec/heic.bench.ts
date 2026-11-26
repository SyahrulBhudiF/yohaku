import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { test } from "vitest"

import { decodeHeic } from "@stacksjs/ts-heic"
import { decode as decodeHeif } from "heif-js/heic"

const fixture = process.env.HEIC_BENCH_FIXTURE
  ? resolve(process.env.HEIC_BENCH_FIXTURE)
  : new URL("../../../support/fixtures/sample.heic", import.meta.url)
const bytes = new Uint8Array(readFileSync(fixture))

const options = (name: string) => ({
  time: 5_000,
  warmupTime: 0,
  iterations: 1,
  writeResult: `.amp/in/bench-heic-${name}.json`,
})

test("decodes HEIC", { timeout: 240_000 }, async ({ bench }) => {
  await bench.compare(
    bench("ts-heic", options("ts-heic"), () => decodeHeic(bytes)),
    bench("heif-js", options("heif-js"), () => decodeHeif(bytes)),
  )
})
