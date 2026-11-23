import { MAX_SPLIT_OUTPUTS, type PdfPageRange } from "@/libs/schemas/pdf"

export type PageRangesResult =
  | { readonly ok: true; readonly ranges: ReadonlyArray<PdfPageRange> }
  | { readonly ok: false; readonly message: string }

export const rangeLabel = (range: PdfPageRange) =>
  range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`

export const validatePageRanges = (
  ranges: ReadonlyArray<PdfPageRange>,
  pageCount: number,
): PageRangesResult => {
  if (ranges.length === 0) {
    return { ok: false, message: "Add at least one page range." }
  }

  if (ranges.length > MAX_SPLIT_OUTPUTS) {
    return {
      ok: false,
      message: `A split can create at most ${MAX_SPLIT_OUTPUTS} files.`,
    }
  }

  for (const range of ranges) {
    if (
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.end) ||
      range.start < 1 ||
      range.end < 1 ||
      range.start > pageCount ||
      range.end > pageCount
    ) {
      return {
        ok: false,
        message: `Ranges must use page numbers from 1 to ${pageCount}.`,
      }
    }

    if (range.start > range.end) {
      return { ok: false, message: "Each range must start before it ends." }
    }
  }

  return { ok: true, ranges }
}

export const parsePageRanges = (input: string, pageCount: number): PageRangesResult => {
  const parts = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return { ok: false, message: "Enter at least one page or range." }
  }

  const ranges: PdfPageRange[] = []

  for (const part of parts) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)

    if (!match) {
      return { ok: false, message: `"${part}" is not a page number or range.` }
    }

    const start = Number(match[1])
    const end = match[2] === undefined ? start : Number(match[2])

    ranges.push({ start, end })
  }

  return validatePageRanges(ranges, pageCount)
}

export type PageSelectionResult =
  | { readonly ok: true; readonly pages: ReadonlyArray<number> }
  | { readonly ok: false; readonly message: string }

export const expandPageRanges = (ranges: ReadonlyArray<PdfPageRange>): ReadonlyArray<number> => {
  const pages = new Set<number>()

  for (const range of ranges) {
    for (let page = range.start; page <= range.end; page++) {
      pages.add(page)
    }
  }

  return [...pages].sort((a, b) => a - b)
}

/** Empty input means every page; otherwise parse comma-separated pages/ranges. */
export const parsePageSelection = (input: string, pageCount: number): PageSelectionResult => {
  if (input.trim() === "") {
    return {
      ok: true,
      pages: Array.from({ length: pageCount }, (_, index) => index + 1),
    }
  }

  const parsed = parsePageRanges(input, pageCount)

  if (!parsed.ok) {
    return parsed
  }

  return { ok: true, pages: expandPageRanges(parsed.ranges) }
}
