import { describe, expect, it } from "vitest"

import { convertVideoToMp3 } from "@/features/video-to-mp3/process"
import { MAX_VIDEO_BYTES } from "@/libs/schemas/video"

describe("convertVideoToMp3", () => {
  it("rejects non-media input before starting the worker", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" })

    await expect(convertVideoToMp3(file, () => {})).rejects.toMatchObject({
      _tag: "VideoToMp3Error",
      message: "Choose a video or audio file.",
    })
  })

  it("rejects media above the browser size cap before starting the worker", async () => {
    const file = new File(["video"], "long-video.mp4", { type: "video/mp4" })

    Object.defineProperty(file, "size", { value: MAX_VIDEO_BYTES + 1 })

    await expect(convertVideoToMp3(file, () => {})).rejects.toMatchObject({
      _tag: "VideoToMp3Error",
      message: "Video and audio files can be at most 500 MB.",
    })
  })
})
