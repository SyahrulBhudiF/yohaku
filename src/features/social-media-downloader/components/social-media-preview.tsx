interface SocialMediaPreviewProps {
  readonly aspectRatio: number
  readonly embedUrl: string
  readonly title: string
}

export function SocialMediaPreview({ aspectRatio, embedUrl, title }: SocialMediaPreviewProps) {
  return (
    <div
      className="w-full overflow-hidden rounded-xl bg-surface-container-low"
      style={{ aspectRatio: String(aspectRatio) }}
    >
      <iframe
        title={`Video preview: ${title}`}
        src={embedUrl}
        className="size-full border-0"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
