import { describe, expect, it } from "vitest"

import { convertVideoToGif } from "@/features/video-to-gif/process"
import { MAX_VIDEO_GIF_INPUT_BYTES } from "@/libs/schemas/video-gif"

const validOptions = {
  startSeconds: 0,
  endSeconds: 5,
  fps: 10,
  width: 360,
}

describe("convertVideoToGif", () => {
  it("rejects non-video files before starting the worker", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" })

    await expect(convertVideoToGif(file, validOptions, () => {})).rejects.toMatchObject({
      _tag: "VideoToGifError",
      message: "Choose a video file.",
    })
  })

  it("rejects files over the browser size limit before starting the worker", async () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    Object.defineProperty(file, "size", { value: MAX_VIDEO_GIF_INPUT_BYTES + 1 })

    await expect(convertVideoToGif(file, validOptions, () => {})).rejects.toMatchObject({
      _tag: "VideoToGifError",
      message: "Video files can be at most 100 MB.",
    })
  })

  it("rejects invalid options and oversized clips before starting the worker", async () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" })

    await expect(
      convertVideoToGif(file, { ...validOptions, fps: 30 }, () => {}),
    ).rejects.toMatchObject({ _tag: "VideoToGifError" })
    await expect(
      convertVideoToGif(file, { ...validOptions, endSeconds: 12 }, () => {}),
    ).rejects.toMatchObject({
      _tag: "VideoToGifError",
      message: expect.stringContaining("10-second"),
    })
  })
})
