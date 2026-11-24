import { MAX_PDF_TOTAL_BYTES } from "@/libs/schemas/pdf"

export const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

export const isPdfBatchWithinSizeLimit = (currentBytes: number, nextBytes: number) =>
  currentBytes + nextBytes <= MAX_PDF_TOTAL_BYTES
