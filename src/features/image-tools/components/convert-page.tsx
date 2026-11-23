import { useConvertStore } from "../store"
import { ImageTool } from "./image-tool"

export function ConvertPage() {
  return (
    <ImageTool
      mode="convert"
      useStore={useConvertStore}
      title="Convert image"
      description="Pick a file and the format you want, including SVG. Everything runs in your browser."
      allowOriginalFormat={false}
      allowSvg
      actionLabel="Convert"
    />
  )
}
