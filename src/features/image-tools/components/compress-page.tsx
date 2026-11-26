import { useCompressStore } from "../store"
import { ImageTool } from "./image-tool"

export function CompressPage() {
  return (
    <ImageTool
      mode="compress"
      useStore={useCompressStore}
      title="Compress image"
      description="Compress HEIC and other images by lowering quality or changing format. Everything runs in your browser."
      allowOriginalFormat
      actionLabel="Compress"
    />
  )
}
