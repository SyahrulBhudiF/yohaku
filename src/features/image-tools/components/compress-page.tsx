import { useCompressStore } from "../store"
import { ImageTool } from "./image-tool"

export function CompressPage() {
  return (
    <ImageTool
      mode="compress"
      useStore={useCompressStore}
      title="Compress image"
      description="Lower the quality to shrink the file. Optionally change the format at the same time."
      allowOriginalFormat
      actionLabel="Compress"
    />
  )
}
