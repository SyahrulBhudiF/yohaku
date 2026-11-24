const MEDIA_EXTENSIONS = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
])

export const isMediaFile = (file: File) => {
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) return true

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()

  return MEDIA_EXTENSIONS.has(extension)
}
