import type { ReactNode } from "react"

import { cn } from "@/libs/utils/cn"
import "./tool-pictogram.css"

const ink = "var(--yohaku-ink)"
const sage = "var(--yohaku-sage)"
const sand = "var(--yohaku-sand)"
const paper = "var(--yohaku-paper)"

const shiftRight = "pictogram-part pic-right"
const shiftLeft = "pictogram-part pic-left"
const shiftUp = "pictogram-part pic-up"
const shiftDown = "pictogram-part pic-down"
const shiftRightUp = `${shiftRight} pic-up`
const shiftRightDown = `${shiftRight} pic-down`

// These illustrations are decorative; the adjacent tool title supplies the label.
const pictograms: Record<string, ReactNode> = {
  "image-convert": (
    <>
      <g className="pictogram-part pic-left pic-tilt">
        <rect x="13" y="17" width="42" height="39" fill={sage} />
        <circle cx="25" cy="28" r="5" fill={paper} />
        <path d="M16 52 30 36l9 10 6-7 10 13Z" fill={ink} />
      </g>
      <rect x="48" y="39" width="30" height="30" fill={sand} className="pictogram-part pic-pop" />
      <path
        d="M45 31h28m-7-7 7 7-7 7"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftRight}
      />
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
      <rect
        x="34"
        y="34"
        width="28"
        height="28"
        fill={sand}
        className="pictogram-part pic-squeeze"
      />
      <path
        d="M48 19v11m-5-5 5 5 5-5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftDown}
      />
      <path
        d="M48 77V66m-5 5 5-5 5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftUp}
      />
      <path
        d="M19 48h11m-5-5 5 5-5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftRight}
      />
      <path
        d="M77 48H66m5-5-5 5 5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftLeft}
      />
    </>
  ),
  "image-resize": (
    <>
      <g className="pictogram-part pic-stretch">
        <rect x="18" y="22" width="44" height="34" fill={sage} />
        <circle cx="30" cy="34" r="4" fill={paper} />
        <path d="M22 50 34 38l7 8 5-5 8 9Z" fill={ink} />
      </g>
      <path
        d="M62 24h18v18M80 24 66 38"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={shiftRightUp}
      />
      <path
        d="M18 76h18V58M18 76l14-14"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={`${shiftLeft} pic-down`}
      />
    </>
  ),
  "image-to-pdf": (
    <>
      <g className="pictogram-part pic-tilt">
        <rect x="37" y="13" width="40" height="58" fill={sand} />
        <path d="M46 55h22M46 62h15" stroke={ink} strokeWidth="2" />
      </g>
      <g className="pictogram-part pic-insert">
        <rect x="15" y="29" width="42" height="40" fill={sage} stroke={paper} strokeWidth="3" />
        <circle cx="27" cy="40" r="4" fill={paper} />
        <path d="M19 65 32 48l8 9 5-6 9 14Z" fill={ink} />
      </g>
    </>
  ),
  "image-remove-background": (
    <>
      <path
        d="M15 17h33v16H32v16H15Zm33 32h17v16H48Zm17-32h16v16H65ZM15 65h17v16H15Zm50 0h16v16H65Z"
        fill={sand}
        className="pictogram-part pic-clear"
      />
      <path
        d="M48 18v63"
        stroke={ink}
        strokeWidth="2"
        strokeDasharray="3 4"
        className="pictogram-part pic-clear"
      />
      <g className="pictogram-part pic-up pic-stretch">
        <circle cx="48" cy="40" r="12" fill={sage} />
        <path d="M28 73c0-13 8-21 20-21s20 8 20 21Z" fill={ink} />
      </g>
    </>
  ),
  "pdf-merge": (
    <>
      <rect x="17" y="15" width="38" height="51" fill={sage} className="pictogram-part pic-stack" />
      <rect
        x="29"
        y="23"
        width="38"
        height="51"
        fill={sand}
        stroke={paper}
        strokeWidth="3"
        className={shiftRightDown}
      />
      <g className="pictogram-part pic-stack-front">
        <rect x="41" y="31" width="38" height="51" fill={ink} stroke={paper} strokeWidth="3" />
        <path d="M50 48h20M50 56h20M50 64h14" stroke={paper} strokeWidth="2" />
      </g>
    </>
  ),
  "pdf-compress": (
    <>
      <path d="M28 12h40v72H28z" fill="none" stroke={sage} strokeWidth="2" strokeDasharray="4 4" />
      <g className="pictogram-part pic-fold">
        <rect x="35" y="29" width="26" height="38" fill={sand} />
        <path d="M41 41h14M41 48h14M41 55h10" fill="none" stroke={ink} strokeWidth="3" />
      </g>
      <path
        d="M48 15v10m-4-4 4 4 4-4"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftDown}
      />
      <path
        d="M48 81V71m-4 4 4-4 4 4"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftUp}
      />
    </>
  ),
  "pdf-extract": (
    <>
      <rect x="16" y="17" width="40" height="54" fill={sage} />
      <path d="M25 29h22M25 37h22M25 45h14" stroke={paper} strokeWidth="2" />
      <g className={`${shiftRightDown} pic-tilt`}>
        <rect x="49" y="35" width="31" height="43" fill={sand} stroke={paper} strokeWidth="3" />
        <path d="M57 47h15M57 54h15M57 61h10" stroke={ink} strokeWidth="2" />
      </g>
      <path d="M43 73h-8v-8" fill="none" stroke={ink} strokeWidth="3" />
    </>
  ),
  "pdf-split": (
    <>
      <rect x="12" y="27" width="31" height="42" fill={ink} />
      <path d="M19 38h17M19 45h17M19 52h12" stroke={paper} strokeWidth="2" />
      <path d="M46 48h10V27h8M56 48v21h8" fill="none" stroke={ink} strokeWidth="2" />
      <rect
        x="64"
        y="13"
        width="21"
        height="28"
        fill={sage}
        className={`${shiftUp} pic-split pic-tilt`}
      />
      <rect
        x="64"
        y="55"
        width="21"
        height="28"
        fill={sand}
        className={`${shiftDown} pic-split pic-tilt-back`}
      />
    </>
  ),
  "pdf-reorganize": (
    <>
      <g className="pictogram-part pic-swap">
        <rect x="14" y="19" width="27" height="35" fill={sage} />
        <path d="M21 29h13M21 36h13" stroke={paper} strokeWidth="2" />
      </g>
      <g className="pictogram-part pic-swap pic-swap-back">
        <rect x="55" y="42" width="27" height="35" fill={sand} />
        <path d="M62 52h13M62 59h13" stroke={paper} strokeWidth="2" />
      </g>
      <path
        d="M51 23h21v10m0 0-5-5m5 5 5-5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftRight}
      />
      <path
        d="M45 73H24V63m0 0-5 5m5-5 5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={shiftLeft}
      />
    </>
  ),
  "pdf-protect": (
    <>
      <rect x="18" y="13" width="46" height="65" fill={sage} />
      <path d="M27 27h28M27 35h28M27 43h17" stroke={paper} strokeWidth="2" />
      <g className="pictogram-part pic-tilt">
        <path
          d="M53 52V42a10 10 0 0 1 20 0v10"
          fill="none"
          stroke={ink}
          strokeWidth="4"
          className={shiftUp}
        />
        <rect x="47" y="50" width="32" height="27" fill={sand} />
        <circle cx="63" cy="61" r="3" fill={ink} />
        <path d="M63 63v6" stroke={ink} strokeWidth="3" />
      </g>
    </>
  ),
  "pdf-to-image": (
    <>
      <rect x="14" y="16" width="39" height="54" fill={ink} />
      <path d="M22 27h23M22 34h23M22 41h16" stroke={paper} strokeWidth="2" />
      <g className="pictogram-part pic-pop pic-tilt-back">
        <rect x="44" y="36" width="38" height="34" fill={sage} stroke={paper} strokeWidth="3" />
        <circle cx="54" cy="46" r="4" fill={sand} />
        <path d="M47 67 59 51l8 9 5-6 7 13Z" fill={ink} />
      </g>
      <path
        d="M34 78h30m-6-6 6 6-6 6"
        fill="none"
        stroke={ink}
        strokeWidth="2"
        className={shiftRight}
      />
    </>
  ),
  "pdf-to-word": (
    <>
      <rect x="14" y="18" width="33" height="47" fill={ink} />
      <path d="M21 29h19M21 36h19M21 43h13" stroke={paper} strokeWidth="2" />
      <g className="pictogram-part pic-pop pic-tilt-back">
        <rect x="53" y="31" width="30" height="44" fill={sage} />
        <path d="m59 45 3 15 5-10 5 10 4-15" fill="none" stroke={paper} strokeWidth="3" />
      </g>
      <path
        d="M37 75h12m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={shiftRight}
      />
    </>
  ),
  "pdf-to-excel": (
    <>
      <rect x="13" y="18" width="34" height="47" fill={ink} />
      <path d="M20 29h20M20 36h20M20 43h13" stroke={paper} strokeWidth="2" />
      <g className="pictogram-part pic-pop pic-tilt-back">
        <rect x="53" y="30" width="31" height="44" fill={sage} />
        <path d="M53 42h31M53 53h31M53 64h31M64 30v44M74 30v44" stroke={paper} strokeWidth="2" />
      </g>
      <path
        d="M35 76h15m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={shiftRight}
      />
    </>
  ),
  "pdf-sign": (
    <>
      <rect x="19" y="12" width="50" height="70" fill={sage} />
      <path d="M28 25h32M28 33h32M28 41h21" stroke={paper} strokeWidth="2" />
      <path
        d="M29 67c5-11 6 5 11-3s4 3 10-1 8 0 11-2"
        fill="none"
        stroke={ink}
        strokeWidth="2"
        pathLength="1"
        className="pictogram-part pic-draw"
      />
      <path
        d="m58 54 18-25 6 4-18 25-9 4Z"
        fill={sand}
        stroke={ink}
        strokeWidth="2"
        className="pictogram-part pic-write"
      />
    </>
  ),
  "excel-to-pdf": (
    <>
      <rect x="13" y="22" width="35" height="46" fill={sage} />
      <path d="M13 34h35M13 45h35M13 56h35M25 22v46M36 22v46" stroke={paper} strokeWidth="2" />
      <g className="pictogram-part pic-pop pic-tilt-back">
        <rect x="54" y="28" width="29" height="42" fill={ink} />
        <path d="M61 40h15M61 47h15M61 54h10" stroke={paper} strokeWidth="2" />
      </g>
      <path
        d="M36 77h15m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={shiftRight}
      />
    </>
  ),
  "word-to-pdf": (
    <>
      <rect x="13" y="22" width="35" height="46" fill={sage} />
      <path d="m20 35 3 17 5-11 5 11 5-17" fill="none" stroke={paper} strokeWidth="3" />
      <g className="pictogram-part pic-pop pic-tilt-back">
        <rect x="54" y="28" width="29" height="42" fill={ink} />
        <path d="M61 40h15M61 47h15M61 54h10" stroke={paper} strokeWidth="2" />
      </g>
      <path
        d="M36 77h15m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={shiftRight}
      />
    </>
  ),
  "video-to-mp3": (
    <>
      <rect x="12" y="20" width="48" height="39" fill={sage} />
      <path d="m31 29 17 10-17 10Z" fill={paper} />
      <g className="pictogram-part pic-pop">
        <circle cx="64" cy="60" r="20" fill={ink} stroke={paper} strokeWidth="3" />
        <circle cx="64" cy="60" r="12" fill="none" stroke={sage} strokeWidth="2" />
        <circle cx="64" cy="60" r="3" fill={sand} />
      </g>
      <path
        d="M75 38v15l-7 3"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={`${shiftRightUp} pic-tilt`}
      />
    </>
  ),
  "social-media-downloader": (
    <>
      <rect x="16" y="16" width="47" height="43" fill={sage} />
      <path d="m34 26 16 11-16 11Z" fill={paper} />
      <g className="pictogram-part pic-pop">
        <circle cx="65" cy="61" r="19" fill={sand} stroke={paper} strokeWidth="3" />
        <path
          d="M65 49v17m-7-7 7 7 7-7"
          fill="none"
          stroke={ink}
          strokeWidth="3"
          className="pictogram-part pic-download"
        />
        <path d="M56 72h18" stroke={ink} strokeWidth="3" />
      </g>
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
      className={cn("tool-pictogram", className)}
    >
      <g className="pic-flourish">
        <circle cx="48" cy="48" r="38" fill={sage} fillOpacity=".13" />
        <ellipse
          cx="48"
          cy="48"
          rx="44"
          ry="41"
          fill="none"
          stroke={sage}
          strokeOpacity=".45"
          strokeDasharray="18 110 8 132"
        />
      </g>
      {pictograms[id]}
      <g fill="none" stroke={sand} strokeWidth="2" strokeLinecap="round">
        <path className="pic-spark" d="M13 19v10m-5-5h10" />
        <path className="pic-spark pic-spark-far" d="M80 13v12m-6-6h12m-7 57 5 5m0-5-5 5" />
      </g>
    </svg>
  )
}
