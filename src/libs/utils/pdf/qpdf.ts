import { Effect } from "effect"

import { PdfPasswordError, PdfProcessingError } from "@/infrastructure/errors/pdf"
import type { PdfPageRange } from "@/libs/schemas/pdf"
import { groupConsecutivePages } from "./pages"

type Qpdf = import("@mssio/qpdf-wasm").Qpdf

export interface PdfMergePage {
  readonly fileId: string
  readonly file: File
  readonly pageNumber: number
  readonly password: string | undefined
}

export interface PdfOutput {
  readonly name: string
  readonly data: Uint8Array<ArrayBuffer>
}

export type PdfSplitRequest =
  | {
      readonly mode: "chunks"
      readonly file: File
      readonly pagesPerFile: number
      readonly password: string | undefined
    }
  | {
      readonly mode: "ranges"
      readonly file: File
      readonly ranges: ReadonlyArray<PdfPageRange>
      readonly password: string | undefined
    }

let engine: Promise<Qpdf> | null = null

const loadEngine = () => {
  if (engine === null) {
    engine = import("@mssio/qpdf-wasm").then(({ createQpdf }) => createQpdf())
    engine.catch(() => {
      engine = null
    })
  }

  return engine
}

const errorCode = (cause: unknown) => {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string"
  ) {
    return cause.code
  }

  return null
}

const mapError = (cause: unknown) => {
  if (errorCode(cause) === "INVALID_PASSWORD") {
    return new PdfPasswordError({ message: "That password did not open the PDF." })
  }

  return new PdfProcessingError({
    message: "This PDF could not be processed. It may be damaged or unsupported.",
  })
}

const runJob = (args: ReadonlyArray<string>, files: Record<string, File>) =>
  Effect.gen(function* () {
    const qpdf = yield* Effect.tryPromise({ try: loadEngine, catch: mapError })
    const result = yield* Effect.tryPromise({
      try: () => qpdf.run([...args], { files }),
      catch: mapError,
    })

    if (result.exitCode !== 0 && result.exitCode !== 3) {
      if (result.stderr.toLowerCase().includes("invalid password")) {
        return yield* new PdfPasswordError({ message: "That password did not open the PDF." })
      }

      return yield* new PdfProcessingError({
        message: "This PDF could not be processed. It may be damaged or unsupported.",
      })
    }

    return result
  })

export const mergePages = (
  pages: ReadonlyArray<PdfMergePage>,
): Effect.Effect<Uint8Array<ArrayBuffer>, PdfPasswordError | PdfProcessingError> =>
  Effect.gen(function* () {
    if (pages.length === 0) {
      return yield* new PdfProcessingError({ message: "Add at least one page to merge." })
    }

    const filesById = new Map<
      string,
      { readonly name: string; readonly file: File; readonly password: string | undefined }
    >()

    for (const page of pages) {
      if (!filesById.has(page.fileId)) {
        filesById.set(page.fileId, {
          name: `in-${filesById.size}.pdf`,
          file: page.file,
          password: page.password,
        })
      }
    }

    const args = ["--empty", "--pages"]

    for (const run of groupConsecutivePages(pages)) {
      const entry = filesById.get(run.fileId)

      if (!entry) {
        return yield* new PdfProcessingError({ message: "A selected PDF is missing." })
      }

      args.push(`--file=${entry.name}`, `--range=${run.pages.join(",")}`)

      if (entry.password) {
        args.push(`--password=${entry.password}`)
      }
    }

    args.push("--", "out.pdf")

    const files = Object.fromEntries(
      [...filesById.values()].map((entry) => [entry.name, entry.file]),
    )
    const result = yield* runJob(args, files)
    const output = result.files["out.pdf"]

    if (!output || output.byteLength === 0) {
      return yield* new PdfProcessingError({ message: "qpdf did not produce a PDF." })
    }

    return output
  })

const createOutputNamer = () => {
  const used = new Set<string>()

  return (range: PdfPageRange) => {
    const label = range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`
    const base = `pages-${label}.pdf`

    if (!used.has(base)) {
      used.add(base)

      return base
    }

    let index = 2

    while (used.has(`pages-${label}-${index}.pdf`)) {
      index++
    }

    const name = `pages-${label}-${index}.pdf`

    used.add(name)

    return name
  }
}

export const splitPdf = (
  request: PdfSplitRequest,
): Effect.Effect<ReadonlyArray<PdfOutput>, PdfPasswordError | PdfProcessingError> =>
  Effect.gen(function* () {
    const qpdf = yield* Effect.tryPromise({ try: loadEngine, catch: mapError })

    if (request.mode === "chunks") {
      const result = yield* Effect.tryPromise({
        try: () =>
          qpdf.split(
            request.file,
            request.password === undefined
              ? { pagesPerFile: request.pagesPerFile }
              : { pagesPerFile: request.pagesPerFile, password: request.password },
          ),
        catch: mapError,
      })

      return result.outputs.map((data, index) => ({
        name: request.pagesPerFile === 1 ? `page-${index + 1}.pdf` : `part-${index + 1}.pdf`,
        data,
      }))
    }

    const outputs: Array<PdfOutput> = []
    const nameFor = createOutputNamer()

    for (const range of request.ranges) {
      const label = range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`
      const result = yield* Effect.tryPromise({
        try: () =>
          qpdf.selectPages(
            request.file,
            label,
            request.password === undefined ? undefined : { password: request.password },
          ),
        catch: mapError,
      })

      outputs.push({ name: nameFor(range), data: result.output })
    }

    if (outputs.length === 0) {
      return yield* new PdfProcessingError({ message: "Add at least one page range." })
    }

    return outputs
  })
