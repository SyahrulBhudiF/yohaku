import type { ReactNode } from "react"

const ink = "var(--yohaku-ink)"
const sage = "var(--yohaku-sage)"
const sand = "var(--yohaku-sand)"
const paper = "var(--yohaku-paper)"

// These illustrations are decorative; the adjacent tool title supplies the label.
const pictograms: Record<string, ReactNode> = {
  "image-convert": (
    <>
      <rect x="13" y="17" width="42" height="39" fill={sage} />
      <circle cx="25" cy="28" r="5" fill={paper} />
      <path d="M16 52 30 36l9 10 6-7 10 13Z" fill={ink} />
      <rect x="48" y="39" width="30" height="30" fill={sand} />
      <path d="M45 31h28m-7-7 7 7-7 7" fill="none" stroke={ink} strokeWidth="3" />
    </>
  ),
  "image-compress": (
    <>
      <rect
        x="14"
        y="14"
        width="68"
        height="68"
        fill="none"
        stroke={sage}
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <rect x="34" y="34" width="28" height="28" fill={sand} />
      <path
        d="M48 19v11m-5-5 5 5 5-5M48 77V66m-5 5 5-5 5 5M19 48h11m-5-5 5 5-5 5M77 48H66m5-5-5 5 5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
      />
    </>
  ),
  "image-to-pdf": (
    <>
      <rect x="37" y="13" width="40" height="58" fill={sand} />
      <path d="M46 55h22M46 62h15" stroke={ink} strokeWidth="2" />
      <rect x="15" y="29" width="42" height="40" fill={sage} stroke={paper} strokeWidth="3" />
      <circle cx="27" cy="40" r="4" fill={paper} />
      <path d="M19 65 32 48l8 9 5-6 9 14Z" fill={ink} />
    </>
  ),
  "image-remove-background": (
    <>
      <path
        d="M15 17h33v16H32v16H15Zm33 32h17v16H48Zm17-32h16v16H65ZM15 65h17v16H15Zm50 0h16v16H65Z"
        fill={sand}
      />
      <path d="M48 18v63" stroke={ink} strokeWidth="2" strokeDasharray="3 4" />
      <circle cx="48" cy="40" r="12" fill={sage} />
      <path d="M28 73c0-13 8-21 20-21s20 8 20 21Z" fill={ink} />
    </>
  ),
  "pdf-merge": (
    <>
      <rect x="17" y="15" width="38" height="51" fill={sage} />
      <rect x="29" y="23" width="38" height="51" fill={sand} stroke={paper} strokeWidth="3" />
      <rect x="41" y="31" width="38" height="51" fill={ink} stroke={paper} strokeWidth="3" />
      <path d="M50 48h20M50 56h20M50 64h14" stroke={paper} strokeWidth="2" />
    </>
  ),
  "pdf-compress": (
    <>
      <path d="M28 12h40v72H28z" fill="none" stroke={sage} strokeWidth="2" strokeDasharray="4 4" />
      <rect x="35" y="29" width="26" height="38" fill={sand} />
      <path
        d="M41 41h14M41 48h14M41 55h10M48 15v10m-4-4 4 4 4-4M48 81V71m-4 4 4-4 4 4"
        fill="none"
        stroke={ink}
        strokeWidth="3"
      />
    </>
  ),
  "pdf-extract": (
    <>
      <rect x="16" y="17" width="40" height="54" fill={sage} />
      <path d="M25 29h22M25 37h22M25 45h14" stroke={paper} strokeWidth="2" />
      <rect x="49" y="35" width="31" height="43" fill={sand} stroke={paper} strokeWidth="3" />
      <path d="M57 47h15M57 54h15M57 61h10" stroke={ink} strokeWidth="2" />
      <path d="M43 73h-8v-8" fill="none" stroke={ink} strokeWidth="3" />
    </>
  ),
  "pdf-split": (
    <>
      <rect x="12" y="27" width="31" height="42" fill={ink} />
      <path d="M19 38h17M19 45h17M19 52h12" stroke={paper} strokeWidth="2" />
      <path d="M46 48h10V27h8M56 48v21h8" fill="none" stroke={ink} strokeWidth="2" />
      <rect x="64" y="13" width="21" height="28" fill={sage} />
      <rect x="64" y="55" width="21" height="28" fill={sand} />
    </>
  ),
  "pdf-reorganize": (
    <>
      <rect x="14" y="19" width="27" height="35" fill={sage} />
      <rect x="55" y="42" width="27" height="35" fill={sand} />
      <path
        d="M51 23h21v10m0 0-5-5m5 5 5-5M45 73H24V63m0 0-5 5m5-5 5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
      />
      <path d="M21 29h13M21 36h13M62 52h13M62 59h13" stroke={paper} strokeWidth="2" />
    </>
  ),
  "pdf-protect": (
    <>
      <rect x="18" y="13" width="46" height="65" fill={sage} />
      <path d="M27 27h28M27 35h28M27 43h17" stroke={paper} strokeWidth="2" />
      <path d="M53 52V42a10 10 0 0 1 20 0v10" fill="none" stroke={ink} strokeWidth="4" />
      <rect x="47" y="50" width="32" height="27" fill={sand} />
      <circle cx="63" cy="61" r="3" fill={ink} />
      <path d="M63 63v6" stroke={ink} strokeWidth="3" />
    </>
  ),
  "pdf-to-image": (
    <>
      <rect x="14" y="16" width="39" height="54" fill={ink} />
      <path d="M22 27h23M22 34h23M22 41h16" stroke={paper} strokeWidth="2" />
      <rect x="44" y="36" width="38" height="34" fill={sage} stroke={paper} strokeWidth="3" />
      <circle cx="54" cy="46" r="4" fill={sand} />
      <path d="M47 67 59 51l8 9 5-6 7 13Z" fill={ink} />
      <path d="M34 78h30m-6-6 6 6-6 6" fill="none" stroke={ink} strokeWidth="2" />
    </>
  ),
  "pdf-to-word": (
    <>
      <rect x="14" y="18" width="33" height="47" fill={ink} />
      <path d="M21 29h19M21 36h19M21 43h13" stroke={paper} strokeWidth="2" />
      <rect x="53" y="31" width="30" height="44" fill={sage} />
      <path d="m59 45 3 15 5-10 5 10 4-15" fill="none" stroke={paper} strokeWidth="3" />
      <path d="M37 75h12m-5-5 5 5-5 5" fill="none" stroke={sand} strokeWidth="3" />
    </>
  ),
  "pdf-to-excel": (
    <>
      <rect x="13" y="18" width="34" height="47" fill={ink} />
      <path d="M20 29h20M20 36h20M20 43h13" stroke={paper} strokeWidth="2" />
      <rect x="53" y="30" width="31" height="44" fill={sage} />
      <path d="M53 42h31M53 53h31M53 64h31M64 30v44M74 30v44" stroke={paper} strokeWidth="2" />
      <path d="M35 76h15m-5-5 5 5-5 5" fill="none" stroke={sand} strokeWidth="3" />
    </>
  ),
  "pdf-sign": (
    <>
      <rect x="19" y="12" width="50" height="70" fill={sage} />
      <path d="M28 25h32M28 33h32M28 41h21" stroke={paper} strokeWidth="2" />
      <path d="M29 67c5-11 6 5 11-3s4 3 10-1 8 0 11-2" fill="none" stroke={ink} strokeWidth="2" />
      <path d="m58 54 18-25 6 4-18 25-9 4Z" fill={sand} stroke={ink} strokeWidth="2" />
    </>
  ),
  "excel-to-pdf": (
    <>
      <rect x="13" y="22" width="35" height="46" fill={sage} />
      <path d="M13 34h35M13 45h35M13 56h35M25 22v46M36 22v46" stroke={paper} strokeWidth="2" />
      <rect x="54" y="28" width="29" height="42" fill={ink} />
      <path d="M61 40h15M61 47h15M61 54h10" stroke={paper} strokeWidth="2" />
      <path d="M36 77h15m-5-5 5 5-5 5" fill="none" stroke={sand} strokeWidth="3" />
    </>
  ),
  "word-to-pdf": (
    <>
      <rect x="13" y="22" width="35" height="46" fill={sage} />
      <path d="m20 35 3 17 5-11 5 11 5-17" fill="none" stroke={paper} strokeWidth="3" />
      <rect x="54" y="28" width="29" height="42" fill={ink} />
      <path d="M61 40h15M61 47h15M61 54h10" stroke={paper} strokeWidth="2" />
      <path d="M36 77h15m-5-5 5 5-5 5" fill="none" stroke={sand} strokeWidth="3" />
    </>
  ),
  "video-to-mp3": (
    <>
      <rect x="12" y="20" width="48" height="39" fill={sage} />
      <path d="m31 29 17 10-17 10Z" fill={paper} />
      <circle cx="64" cy="60" r="20" fill={ink} stroke={paper} strokeWidth="3" />
      <circle cx="64" cy="60" r="12" fill="none" stroke={sage} strokeWidth="2" />
      <circle cx="64" cy="60" r="3" fill={sand} />
      <path d="M75 38v15l-7 3" fill="none" stroke={sand} strokeWidth="3" />
    </>
  ),
  "social-media-downloader": (
    <>
      <rect x="16" y="16" width="47" height="43" fill={sage} />
      <path d="m34 26 16 11-16 11Z" fill={paper} />
      <circle cx="65" cy="61" r="19" fill={sand} stroke={paper} strokeWidth="3" />
      <path d="M65 49v17m-7-7 7 7 7-7M56 72h18" fill="none" stroke={ink} strokeWidth="3" />
    </>
  ),
}

export function ToolPictogram({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 96 96"
      width="96"
      height="96"
      className={className}
    >
      {pictograms[id]}
    </svg>
  )
}
