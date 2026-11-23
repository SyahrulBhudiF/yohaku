import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

export const fixtureBytes = async (name: string) =>
  new Uint8Array(await readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))))

export const fixtureFile = async (name: string) =>
  new File([await fixtureBytes(name)], name, { type: "application/pdf" })

export const extractPdfText = async (bytes: Uint8Array, password?: string) => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const task = getDocument({
    data: new Uint8Array(bytes),
    password,
    useWorkerFetch: false,
  })
  const document = await task.promise
  const pages: Array<string> = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    pages.push(text)
  }

  await task.destroy()

  return pages
}
