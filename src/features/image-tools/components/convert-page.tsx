import { useConvertStore } from "../store"
import { ImageTool } from "./image-tool"

export function ConvertPage() {
  return (
    <ImageTool
      mode="convert"
      useStore={useConvertStore}
      title="Convert image"
      description="Convert HEIC and HEIF photos to JPG, or change image formats including SVG. Everything runs in your browser."
      allowOriginalFormat={false}
      allowSvg
      actionLabel="Convert"
    />
  )
}
