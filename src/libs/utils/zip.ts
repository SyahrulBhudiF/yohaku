import { Zip, ZipPassThrough } from "fflate"

export interface ZipWriter {
  readonly add: (name: string, data: Uint8Array) => void
  readonly finish: () => Blob
  readonly error: () => Error | null
}

/** Streams entries into Blob parts instead of copying the whole archive. */
export const createZipWriter = (): ZipWriter => {
  const parts: Array<BlobPart> = []
  let failure: Error | null = null
  const zip = new Zip((error, chunk) => {
    if (error) {
      failure = error

      return
    }

    if (chunk) {
      parts.push(new Blob([chunk]))
    }
  })

  return {
    add: (name, data) => {
      const entry = new ZipPassThrough(name)

      zip.add(entry)
      entry.push(data, true)
    },
    finish: () => {
      zip.end()

      return new Blob(parts, { type: "application/zip" })
    },
    error: () => failure,
  }
}
