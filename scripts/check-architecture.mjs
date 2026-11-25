import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const root = process.cwd()
const strict = process.argv.includes("--strict")
const failures = []
const warnings = []

const walk = async (directory) => {
  const entries = await readdir(join(root, directory), { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walk(path)))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

const read = (path) => readFile(join(root, path), "utf8")
const files = await walk("src")
const sourceFiles = files.filter(
  (file) => (file.endsWith(".ts") || file.endsWith(".tsx")) && !file.includes("/libs/wasm/"),
)

for (const file of sourceFiles) {
  const content = await read(file)

  if (/\bnew Error\s*\(/.test(content)) {
    failures.push(`${file}: construct a Schema.TaggedError instead of a plain Error`)
  }

  if (file.startsWith("src/libs/schemas/") && /^\s*(export\s+)?interface\s+/m.test(content)) {
    failures.push(`${file}: schemas must use Effect Schema, not interface declarations`)
  }

  if (file.endsWith("/process.ts") && !content.includes("runEffect")) {
    failures.push(`${file}: process.ts must expose its work through runEffect`)
  }

  if (file.endsWith("/process.ts") && /from\s+"react"/.test(content)) {
    failures.push(`${file}: process.ts must stay framework-free`)
  }

  if (file.startsWith("src/routes/") && file.endsWith(".tsx") && !file.endsWith("__root.tsx")) {
    const imports = [...content.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1])
    const invalid = imports.filter(
      (specifier) => specifier !== "@tanstack/react-router" && !specifier.startsWith("@/features/"),
    )

    if (invalid.length > 0) {
      failures.push(`${file}: routes may only import the route helper and a feature page`)
    }
  }

  if (file.includes("/components/") && file.endsWith(".tsx")) {
    if (/\bfetch\s*\(/.test(content)) {
      failures.push(`${file}: fetch belongs in a feature process or server function`)
    }

    if (/\brunEffect\s*\(/.test(content)) {
      failures.push(`${file}: runEffect belongs in a process or hook, not a component`)
    }

    if (/\bonSubmit:\s*async\b/.test(content)) {
      warnings.push(`${file}: use mutation.mutate instead of an async form submit`)
    }

    if (/\bmutateAsync\s*\(/.test(content)) {
      warnings.push(`${file}: use mutate; keep async orchestration in a hook or process`)
    }

    if (/\bawait\b/.test(content)) {
      warnings.push(`${file}: move raw await orchestration out of the view`)
    }
  }

  if (
    (file.startsWith("src/features/") || file.startsWith("src/components/")) &&
    (file.endsWith(".ts") || file.endsWith(".tsx"))
  ) {
    const lines = content.split("\n")

    for (const [index, line] of lines.entries()) {
      if (!line.includes("useEffect(")) {
        continue
      }

      const previous = lines
        .slice(0, index)
        .reverse()
        .find((candidate) => candidate.trim() !== "")

      if (!previous?.includes("architecture: external synchronization")) {
        warnings.push(
          `${file}:${index + 1}: useEffect needs an "architecture: external synchronization" justification`,
        )
      }
    }
  }
}

if (files.some((file) => file.startsWith("src/routes/api/"))) {
  failures.push("src/routes/api: use createServerFn in src/apis instead")
}

const report = (label, items) => {
  if (items.length === 0) {
    return
  }

  process.stderr.write(`\n${label}:\n${items.map((item) => `  - ${item}`).join("\n")}\n`)
}

report("Architecture failures", failures)
report("Architecture warnings", warnings)

if (failures.length > 0 || (strict && warnings.length > 0)) {
  process.stderr.write("\nArchitecture check failed.\n")
  process.exit(1)
}

process.stdout.write("Architecture check passed.\n")
