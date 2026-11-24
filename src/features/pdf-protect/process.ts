import { Effect, Schema } from "effect"

import {
  PdfDecryptionError,
  PdfEncryptionError,
  PdfInvalidFileError,
  PdfPasswordError,
} from "@/infrastructure/errors/pdf"
import { runEffect } from "@/infrastructure/runtime"
import { PdfProcessor } from "@/infrastructure/services/pdf-processor"
import type { PdfDocumentOutput } from "@/libs/utils/pdf/qpdf"
import type { PdfProtectionOutput } from "./types"
import {
  MAX_PDF_BYTES,
  PdfProtectFormSchema,
  PdfUnlockFormSchema,
  type PdfProtectFormValues,
  type PdfUnlockFormValues,
} from "@/libs/schemas/pdf"
import { isPdfFile } from "@/features/pdf-tools/validation"

export type PdfProtectInput = { readonly file: File } & PdfProtectFormValues
export type PdfUnlockInput = { readonly file: File } & PdfUnlockFormValues

const validateFile = (file: File) => {
  if (!isPdfFile(file)) {
    return new PdfInvalidFileError({ message: "Choose a PDF file." })
  }

  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return new PdfInvalidFileError({
      message:
        file.size === 0
          ? "This PDF is empty."
          : `PDFs can be at most ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
    })
  }

  return null
}

const createOutput = (
  file: File,
  output: PdfDocumentOutput,
  operation: PdfProtectionOutput["operation"],
): PdfProtectionOutput => {
  const name = file.name.replace(/\.pdf$/i, "") || "document"

  const metadata = {
    fileName: `${name}-${operation}.pdf`,
    operation,
    inputBytes: file.size,
    outputBytes: output.size,
  }

  return output instanceof Blob ? { ...metadata, blob: output } : { ...metadata, url: output.url }
}

export const protectPdfFile = (input: PdfProtectInput): Promise<PdfProtectionOutput> =>
  runEffect(
    Effect.gen(function* () {
      const fileError = validateFile(input.file)

      if (fileError) return yield* fileError

      const values = yield* Schema.decodeEffect(PdfProtectFormSchema)(input).pipe(
        Effect.mapError(
          () => new PdfEncryptionError({ message: "Use a password between 8 and 128 characters." }),
        ),
      )

      if (values.password !== values.confirmation) {
        return yield* new PdfEncryptionError({ message: "The passwords do not match." })
      }

      const processor = yield* PdfProcessor
      const bytes = yield* processor.protect(input.file, values.password)

      return createOutput(input.file, bytes, "protected")
    }),
  )

export const unlockPdfFile = (input: PdfUnlockInput): Promise<PdfProtectionOutput> =>
  runEffect(
    Effect.gen(function* () {
      const fileError = validateFile(input.file)

      if (fileError) return yield* fileError

      const values = yield* Schema.decodeEffect(PdfUnlockFormSchema)(input).pipe(
        Effect.mapError(
          () => new PdfPasswordError({ message: "Enter a password up to 128 characters long." }),
        ),
      )
      const processor = yield* PdfProcessor
      const bytes = yield* processor.unlock(input.file, values.password)

      return createOutput(input.file, bytes, "unlocked")
    }),
  )

export type PdfProtectionError =
  | PdfDecryptionError
  | PdfEncryptionError
  | PdfInvalidFileError
  | PdfPasswordError
