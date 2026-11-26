const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm|mkv|avi|ogv|3gp)$/i

export const isVideoFile = (file: File) =>
  file.type.startsWith("video/") || VIDEO_EXTENSION.test(file.name)

/** A user-selected end time can extend past a short clip; stop at the video's end. */
export const clampClipEnd = (endSeconds: number, duration: number) => Math.min(endSeconds, duration)
