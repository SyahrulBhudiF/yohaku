import { describe, expect, it } from "vitest"

import { clampClipEnd, isVideoFile } from "@/features/video-to-gif/validation"

describe("video-to-gif validation", () => {
  it("clamps an end time to the video duration", () => {
    expect(clampClipEnd(5, 3)).toBe(3)
    expect(clampClipEnd(2, 3)).toBe(2)
    expect(clampClipEnd(10, 10)).toBe(10)
  })

  it("accepts video mime types and extensions", () => {
    expect(isVideoFile(new File(["x"], "clip.mp4", { type: "" }))).toBe(true)
    expect(isVideoFile(new File(["x"], "clip.webm", { type: "video/webm" }))).toBe(true)
    expect(isVideoFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(false)
  })
})
