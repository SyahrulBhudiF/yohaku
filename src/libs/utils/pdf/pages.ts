export interface PdfPageOrderItem {
  readonly fileId: string
  readonly pageNumber: number
}

export interface PdfPageRun {
  readonly fileId: string
  readonly pages: ReadonlyArray<number>
}

/**
 * Groups consecutive pages from the same file so qpdf can read each file once
 * per run while keeping the user's page order.
 */
export const groupConsecutivePages = (
  pages: ReadonlyArray<PdfPageOrderItem>,
): ReadonlyArray<PdfPageRun> => {
  const runs: Array<{ fileId: string; pages: number[] }> = []

  for (const page of pages) {
    const last = runs.at(-1)

    if (last?.fileId === page.fileId) {
      last.pages.push(page.pageNumber)
    } else {
      runs.push({ fileId: page.fileId, pages: [page.pageNumber] })
    }
  }

  return runs
}
