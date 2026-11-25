export const isPptxFile = (file: File) =>
  /\.pptx$/i.test(file.name) ||
  file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"

export const isLegacyPptFile = (file: File) =>
  /\.ppt$/i.test(file.name) || file.type === "application/vnd.ms-powerpoint"
