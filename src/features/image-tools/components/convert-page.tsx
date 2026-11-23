import { useConvertStore } from "../store"
import { ImageTool } from "./image-tool"

export function ConvertPage() {
  return (
    <ImageTool
      mode="convert"
      useStore={useConvertStore}
      title="Convert image"
      description="Pick a file and the format you want. Nothing is stored on the server."
      allowOriginalFormat={false}
      actionLabel="Convert"
    />
  )
}
