import { describe, expect, it } from "vitest"
import sharp from "sharp"

import { handleCompressImage, handleConvertImage } from "@/apis/image"

const makeRequest = async (fields: Record<string, string>, file?: File) => {
  const form = new FormData()

  Object.entries(fields).forEach(([key, value]) => form.set(key, value))

  if (file) {
    form.set("file", file)
  }

  return new Request("http://localhost/api", { method: "POST", body: form })
}

const makePngFile = async () => {
  const buffer = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#6750a4" },
  })
    .png()
    .toBuffer()

  return new File([new Uint8Array(buffer)], "photo.png", { type: "image/png" })
}

describe("image api", () => {
  it("converts and names the download after the new format", async () => {
    const response = await handleConvertImage(
      await makeRequest({ format: "jpeg", quality: "80" }, await makePngFile()),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/jpeg")
    expect(response.headers.get("Content-Disposition")).toContain('filename="photo.jpg"')
  })

  it("compresses keeping the source format when none is given", async () => {
    const response = await handleCompressImage(
      await makeRequest({ quality: "50" }, await makePngFile()),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Content-Disposition")).toContain("photo-compressed.png")
  })

  it("maps invalid options to 400", async () => {
    const response = await handleConvertImage(
      await makeRequest({ format: "bmp", quality: "80" }, await makePngFile()),
    )

    expect(response.status).toBe(400)
    expect((await response.json())._tag).toBe("InvalidRequestError")
  })

  it("rejects a missing file with 400 and a corrupt file with 422", async () => {
    const missing = await handleConvertImage(await makeRequest({ format: "png", quality: "80" }))
    const corrupt = await handleConvertImage(
      await makeRequest(
        { format: "png", quality: "80" },
        new File(["nope"], "x.png", { type: "image/png" }),
      ),
    )

    expect(missing.status).toBe(400)
    expect(corrupt.status).toBe(422)
  })

  it("rejects quality outside 1-100", async () => {
    const response = await handleCompressImage(
      await makeRequest({ quality: "101" }, await makePngFile()),
    )

    expect(response.status).toBe(400)
  })
})
