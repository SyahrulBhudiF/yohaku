import { Effect } from "effect"

import {
  PdfCompressionError,
  PdfDecryptionError,
  PdfEncryptionError,
  PdfPasswordError,
  PdfProcessingError,
  PdfReorganizationError,
} from "@/infrastructure/errors/pdf"
import { MAX_PDF_PAGES, type PdfPageRange } from "@/libs/schemas/pdf"
import { groupConsecutivePages } from "./pages"
import type { PdfQpdf, QpdfWorkerBlob } from "./qpdf-worker-protocol"

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

export type PdfDocumentOutput = Blob | QpdfWorkerBlob

export interface PdfReorganizationPage {
  readonly pageNumber: number
  readonly rotation: 0 | 90 | 180 | 270
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

let engine: Promise<PdfQpdf> | null = null

const loadEngine = () => {
  if (engine === null) {
    engine =
      typeof Worker === "undefined"
        ? import("@mssio/qpdf-wasm").then(({ createQpdf }) => createQpdf())
        : import("./qpdf-worker-client").then(({ createQpdfWorkerClient }) =>
            createQpdfWorkerClient(),
          )
    engine.catch(() => {
      engine = null
    })
  }

  return engine
}

const describeCause = (cause: unknown) => {
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    return String(cause.message)
  }

  return String(cause)
}

const mapCompressionError = (cause: unknown) => {
  if (errorCode(cause) === "INVALID_PASSWORD" || /invalid password/i.test(describeCause(cause))) {
    return new PdfPasswordError({ message: "That password did not open the PDF." })
  }

  const message = describeCause(cause)
  const detail = message.match(/(?:qpdf failed:|Error: )([^\r\n]+)/i)?.[1]?.trim()

  return new PdfCompressionError({
    message: detail
      ? `Could not compress this PDF: ${detail}`
      : "Could not compress this PDF. The file may use an unsupported PDF feature.",
  })
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

const mapReorganizationError = (cause: unknown) =>
  errorCode(cause) === "INVALID_PASSWORD"
    ? new PdfPasswordError({ message: "That password did not open the PDF." })
    : new PdfReorganizationError({
        message: "Could not reorganize this PDF. It may be damaged or unsupported.",
      })

const mapEncryptionError = () =>
  new PdfEncryptionError({
    message: "Could not protect this PDF. It may already be password-protected or unsupported.",
  })

const mapDecryptionError = (cause: unknown) =>
  errorCode(cause) === "INVALID_PASSWORD"
    ? new PdfPasswordError({ message: "That password did not open the PDF." })
    : new PdfDecryptionError({
        message: "Could not remove password protection from this PDF.",
      })

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

export interface PdfCompressionResult {
  readonly data: Uint8Array<ArrayBuffer>
  readonly inputBytes: number
  readonly outputBytes: number
  readonly pages: number
}

export const compressPdf = (
  file: File,
  password?: string,
): Effect.Effect<PdfCompressionResult, PdfPasswordError | PdfCompressionError> =>
  Effect.gen(function* () {
    const qpdf = yield* Effect.tryPromise({
      try: loadEngine,
      catch: (cause) =>
        new PdfCompressionError({
          message: `Could not start the PDF compression engine: ${describeCause(cause)}`,
        }),
    })
    const info = yield* Effect.tryPromise({
      try: () => qpdf.info(file, password === undefined ? {} : { password }),
      catch: mapCompressionError,
    })
    const result = yield* Effect.tryPromise({
      try: () => qpdf.compress(file, password === undefined ? {} : { password }),
      catch: mapCompressionError,
    })

    if (result.output.byteLength === 0) {
      return yield* new PdfCompressionError({
        message: "qpdf finished without producing an output file.",
      })
    }

    return {
      data: result.output,
      inputBytes: file.size,
      outputBytes: result.output.byteLength,
      pages: info.pageCount,
    } satisfies PdfCompressionResult
  })

export const extractPages = (
  file: File,
  pages: ReadonlyArray<number>,
  password?: string,
): Effect.Effect<Uint8Array<ArrayBuffer>, PdfPasswordError | PdfProcessingError> =>
  Effect.gen(function* () {
    if (pages.length === 0) {
      return yield* new PdfProcessingError({ message: "Choose at least one page to extract." })
    }

    const qpdf = yield* Effect.tryPromise({ try: loadEngine, catch: mapError })
    const selection = pages.join(",")
    const result = yield* Effect.tryPromise({
      try: () =>
        qpdf.selectPages(file, selection, password === undefined ? undefined : { password }),
      catch: mapError,
    })

    if (result.output.byteLength === 0) {
      return yield* new PdfProcessingError({ message: "qpdf did not produce an extracted PDF." })
    }

    return result.output
  })

export const reorganizePages = (
  file: File,
  pages: ReadonlyArray<PdfReorganizationPage>,
  password?: string,
): Effect.Effect<Uint8Array<ArrayBuffer>, PdfPasswordError | PdfReorganizationError> =>
  Effect.gen(function* () {
    if (pages.length === 0) {
      return yield* new PdfReorganizationError({ message: "Keep at least one PDF page." })
    }

    const selectedPages = new Set<number>()

    for (const page of pages) {
      if (
        !Number.isInteger(page.pageNumber) ||
        page.pageNumber < 1 ||
        page.pageNumber > MAX_PDF_PAGES ||
        selectedPages.has(page.pageNumber)
      ) {
        return yield* new PdfReorganizationError({
          message: "The page order contains an invalid or repeated page.",
        })
      }

      if (![0, 90, 180, 270].includes(page.rotation)) {
        return yield* new PdfReorganizationError({
          message: "Page rotation must be 0, 90, 180, or 270 degrees.",
        })
      }

      selectedPages.add(page.pageNumber)
    }

    const qpdf = yield* Effect.tryPromise({ try: loadEngine, catch: mapReorganizationError })
    const rotations = new Map<90 | 180 | 270, Array<number>>()

    for (const page of pages) {
      if (page.rotation !== 0) {
        const selected = rotations.get(page.rotation) ?? []

        selected.push(page.pageNumber)
        rotations.set(page.rotation, selected)
      }
    }

    let input: File | Uint8Array<ArrayBuffer> = file

    if (rotations.size > 0) {
      const result = yield* Effect.tryPromise({
        try: () =>
          qpdf.rotate(
            file,
            [...rotations].map(([angle, selected]) => ({
              angle,
              pages: selected.join(","),
            })),
            password === undefined ? undefined : { password },
          ),
        catch: mapReorganizationError,
      })

      input = result.output
    }

    const result = yield* Effect.tryPromise({
      try: () =>
        qpdf.selectPages(
          input,
          pages.map(({ pageNumber }) => pageNumber).join(","),
          password === undefined ? undefined : { password },
        ),
      catch: mapReorganizationError,
    })

    if (result.output.byteLength === 0) {
      return yield* new PdfReorganizationError({ message: "qpdf did not produce a PDF." })
    }

    return result.output
  })

const createPdfOutput = (output: Uint8Array<ArrayBuffer> | Blob | QpdfWorkerBlob) => {
  if (typeof Blob !== "undefined" && output instanceof Blob) return output

  if (!(output instanceof Uint8Array)) return output

  return new Blob([output], { type: "application/pdf" })
}

export const protectPdf = (
  file: File,
  password: string,
): Effect.Effect<PdfDocumentOutput, PdfEncryptionError> =>
  Effect.gen(function* () {
    const qpdf = yield* Effect.tryPromise({ try: loadEngine, catch: mapEncryptionError })
    const result = yield* Effect.tryPromise({
      try: () => qpdf.encrypt(file, { userPassword: password, ownerPassword: password, bits: 256 }),
      catch: mapEncryptionError,
    })

    const output = createPdfOutput(result.output)

    if (output.size === 0) {
      return yield* mapEncryptionError()
    }

    return output
  })

export const unlockPdf = (
  file: File,
  password: string,
): Effect.Effect<PdfDocumentOutput, PdfPasswordError | PdfDecryptionError> =>
  Effect.gen(function* () {
    const qpdf = yield* Effect.tryPromise({ try: loadEngine, catch: mapDecryptionError })
    const result = yield* Effect.tryPromise({
      try: () => qpdf.decrypt(file.slice(), { password }),
      catch: mapDecryptionError,
    })

    const output = createPdfOutput(result.output)

    if (output.size === 0) {
      return yield* new PdfDecryptionError({ message: "qpdf did not produce an unlocked PDF." })
    }

    return output
  })

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
