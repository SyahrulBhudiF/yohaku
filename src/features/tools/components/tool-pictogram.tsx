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
const revealOutput = "pictogram-part pic-output"
const transfer = "pictogram-part pic-transfer"
const signature = "M29 67c5-11 6 5 11-3s4 3 10-1 8 0 11-2"

// These illustrations are decorative; the adjacent tool title supplies the label.
const pictograms: Record<string, ReactNode> = {
  "image-convert": (
    <>
      <g className={shiftLeft}>
        <rect x="13" y="17" width="42" height="39" fill={sage} />
        <circle cx="25" cy="28" r="5" fill={paper} />
        <path d="M16 52 30 36l9 10 6-7 10 13Z" fill={ink} />
      </g>
      <g className="pictogram-part pic-convert-output">
        <rect x="48" y="39" width="30" height="30" fill={sand} />
        <g className="pic-reveal" opacity="0">
          <circle cx="57" cy="48" r="3" fill={paper} />
          <path d="m52 64 9-12 5 6 3-4 5 10Z" fill={ink} />
        </g>
      </g>
      <path
        d="M45 31h28m-7-7 7 7-7 7"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={transfer}
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
        className={`${shiftDown} pic-press`}
      />
      <path
        d="M48 77V66m-5 5 5-5 5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={`${shiftUp} pic-press`}
      />
      <path
        d="M19 48h11m-5-5 5 5-5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={`${shiftRight} pic-press`}
      />
      <path
        d="M77 48H66m5-5-5 5 5 5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={`${shiftLeft} pic-press`}
      />
    </>
  ),
  "image-batch-compress": (
    <>
      <g className="pictogram-part pic-batch-back">
        <rect x="10" y="16" width="38" height="28" fill={sage} />
        <circle cx="21" cy="26" r="4" fill={paper} />
        <path d="M14 40 25 28l7 7 5-4 7 9Z" fill={ink} />
      </g>
      <g className="pictogram-part pic-batch-front">
        <rect x="34" y="30" width="38" height="28" fill={sand} />
        <circle cx="45" cy="40" r="4" fill={paper} />
        <path d="M38 54 49 42l7 7 5-4 7 9Z" fill={ink} />
      </g>
      <path
        d="M74 20v14m-5-5 5 5 5-5"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={`${shiftDown} pic-press`}
      />
      <rect x="64" y="58" width="20" height="22" fill={ink} />
      <path d="M70 65h8M70 70h8M70 75h5" stroke={paper} strokeWidth="2" />
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
  "favicon-generator": (
    <>
      <rect x="10" y="14" width="76" height="64" rx="5" fill={sage} />
      <path d="M10 26h76" stroke={paper} strokeWidth="2" />
      <circle cx="17" cy="20" r="1.8" fill={paper} />
      <circle cx="23" cy="20" r="1.8" fill={paper} />
      <circle cx="29" cy="20" r="1.8" fill={paper} />
      <g className="pictogram-part pic-app-icon">
        <rect x="33" y="34" width="30" height="30" rx="4" fill={sand} />
        <circle cx="43" cy="44" r="4" fill={paper} />
        <path d="M37 58 47 47l6 6 4-4 6 9Z" fill={ink} />
      </g>
      <g className="pic-reveal" fill={paper}>
        <rect x="68" y="38" width="6" height="6" />
        <rect x="68" y="48" width="8" height="8" />
        <rect x="68" y="60" width="10" height="10" />
      </g>
      <path
        d="M48 69v9m-4-4 4 4 4-4"
        fill="none"
        stroke={ink}
        strokeWidth="2.5"
        className="pictogram-part pic-download"
      />
    </>
  ),
  "svg-to-image": (
    <>
      <g className={shiftLeft}>
        <rect x="12" y="14" width="46" height="58" fill={sage} />
        <path
          d="M25 31c8-9 17 9 25 0M25 45c8-9 17 9 25 0M25 59c8-9 17 9 25 0"
          fill="none"
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g className="pictogram-part pic-convert-output">
        <rect x="46" y="40" width="34" height="32" fill={sand} />
        <g className="pic-reveal">
          <circle cx="55" cy="49" r="3" fill={paper} />
          <path d="m50 65 9-12 5 6 3-4 5 10Z" fill={ink} />
        </g>
      </g>
      <path
        d="M45 30h27m-6-6 6 6-6 6"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "csv-excel": (
    <>
      <g className={shiftLeft}>
        <rect x="11" y="13" width="46" height="62" fill={paper} stroke={ink} strokeWidth="2" />
        <rect x="11" y="13" width="46" height="12" fill={sage} />
        <path d="M19 35h30M19 43h30M19 51h30M19 59h30M11 31h46" stroke={ink} strokeWidth="1.5" />
        <path d="M27 13v62M42 13v62" stroke={ink} strokeWidth="1.5" />
      </g>
      <g className="pictogram-part pic-convert-output">
        <rect x="47" y="34" width="35" height="40" fill={sand} />
        <path d="M54 44h21M54 52h21M54 60h14" stroke={ink} strokeWidth="2.5" />
        <g className="pic-reveal">
          <path d="M58 68h12" stroke={ink} strokeWidth="2.5" />
        </g>
      </g>
      <path
        d="M44 28h25m-6-6 6 6-6 6"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "image-watermark": (
    <>
      <rect x="12" y="14" width="72" height="68" fill={sage} />
      <circle cx="30" cy="30" r="6" fill={paper} />
      <path d="M16 72 38 46l12 14 8-9 14 21Z" fill={ink} />
      <g className="pictogram-part pic-stamp">
        <g transform="rotate(-18 48 48)">
          <rect x="14" y="38" width="68" height="20" fill={sand} opacity=".92" />
          <path d="M24 48h48" stroke={ink} strokeWidth="2.5" />
        </g>
      </g>
      <g className="pic-reveal" fill="none" stroke={sand} strokeWidth="2" strokeLinecap="round">
        <path d="M74 20v8m-4-4h8" />
      </g>
    </>
  ),
  "image-metadata-cleaner": (
    <>
      <rect x="12" y="14" width="72" height="68" fill={sage} />
      <circle cx="30" cy="30" r="6" fill={paper} />
      <path d="M16 72 38 46l12 14 8-9 14 21Z" fill={ink} />
      <g className="pictogram-part pic-clear">
        <rect x="52" y="20" width="26" height="16" fill={sand} />
        <path d="M57 25h16M57 30h10" stroke={ink} strokeWidth="2" />
      </g>
      <g className="pic-reveal" fill="none" stroke={sand} strokeWidth="4" strokeLinecap="round">
        <path d="m62 58 7 7 14-16" />
      </g>
    </>
  ),
  "image-to-pdf": (
    <>
      <g>
        <rect x="37" y="13" width="40" height="58" fill={sand} />
        <path d="M46 55h22M46 62h15" stroke={ink} strokeWidth="2" />
        <path d="M46 62h15" stroke={paper} strokeWidth="2" opacity="0" className="pic-reveal" />
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
      <g>
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
        className="pictogram-part pic-stack-middle"
      />
      <g>
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
        className={`${shiftDown} pic-press`}
      />
      <path
        d="M48 81V71m-4 4 4-4 4 4"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        className={`${shiftUp} pic-press`}
      />
    </>
  ),
  "pdf-extract": (
    <>
      <rect x="16" y="17" width="40" height="54" fill={sage} />
      <path d="M25 29h22M25 37h22M25 45h14" stroke={paper} strokeWidth="2" />
      <g className="pictogram-part pic-extract-page">
        <rect x="49" y="35" width="31" height="43" fill={sand} stroke={paper} strokeWidth="3" />
        <path d="M57 47h15M57 54h15M57 61h10" stroke={ink} strokeWidth="2" />
      </g>
      <path d="M43 73h-8v-8" fill="none" stroke={ink} strokeWidth="3" className={shiftRight} />
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
        className={`${shiftUp} pic-split-page`}
      />
      <rect
        x="64"
        y="55"
        width="21"
        height="28"
        fill={sand}
        className={`${shiftDown} pic-split-page`}
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
      <g>
        <path
          d="M53 52V42a10 10 0 0 1 20 0v10"
          fill="none"
          stroke={ink}
          strokeWidth="4"
          className="pictogram-part pic-unlock"
        />
        <rect x="47" y="50" width="32" height="27" fill={sand} />
        <circle cx="63" cy="61" r="3" fill={ink} />
        <path d="M63 63v6" stroke={ink} strokeWidth="3" />
        <path
          d="M70 44h7m-3.5-3.5v7"
          stroke={sand}
          strokeWidth="2"
          opacity="0"
          className="pic-reveal"
        />
      </g>
    </>
  ),
  "pdf-annotate": (
    <>
      <rect x="14" y="12" width="48" height="72" fill={sage} />
      <path d="M23 24h30M23 32h30M23 40h18" stroke={paper} strokeWidth="2" />
      <g className="pictogram-part pic-stamp">
        <rect x="21" y="48" width="34" height="10" fill={sand} opacity=".9" />
        <path d="M27 53h22" stroke={ink} strokeWidth="2" />
      </g>
      <path
        d="M36 77h10M41 77V68l-4 3"
        fill="none"
        stroke={paper}
        strokeWidth="2"
        className="pic-imprint"
      />
      <path
        d="M70 18v12m-6-6h12"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={shiftRightUp}
      />
    </>
  ),
  "pdf-to-image": (
    <>
      <rect x="14" y="16" width="39" height="54" fill={ink} />
      <path d="M22 27h23M22 34h23M22 41h16" stroke={paper} strokeWidth="2" />
      <g className={revealOutput}>
        <rect x="44" y="36" width="38" height="34" fill={sage} stroke={paper} strokeWidth="3" />
        <g className="pic-imprint">
          <circle cx="54" cy="46" r="4" fill={sand} />
          <path d="M47 67 59 51l8 9 5-6 7 13Z" fill={ink} />
        </g>
      </g>
      <path
        d="M34 78h30m-6-6 6 6-6 6"
        fill="none"
        stroke={ink}
        strokeWidth="2"
        className={transfer}
      />
    </>
  ),
  "pdf-to-word": (
    <>
      <rect x="14" y="18" width="33" height="47" fill={ink} />
      <path d="M21 29h19M21 36h19M21 43h13" stroke={paper} strokeWidth="2" />
      <g className={revealOutput}>
        <rect x="53" y="31" width="30" height="44" fill={sage} />
        <path
          d="m59 45 3 15 5-10 5 10 4-15"
          fill="none"
          stroke={paper}
          strokeWidth="3"
          className="pic-imprint"
        />
      </g>
      <path
        d="M37 75h12m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "pdf-to-excel": (
    <>
      <rect x="13" y="18" width="34" height="47" fill={ink} />
      <path d="M20 29h20M20 36h20M20 43h13" stroke={paper} strokeWidth="2" />
      <g className={revealOutput}>
        <rect x="53" y="30" width="31" height="44" fill={sage} />
        <path d="M53 42h31M53 53h31M53 64h31M64 30v44M74 30v44" stroke={paper} strokeWidth="2" />
        <path d="M65 43h8v9h-8Z" fill={sand} opacity="0" className="pic-reveal" />
      </g>
      <path
        d="M35 76h15m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "pdf-sign": (
    <>
      <rect x="19" y="12" width="50" height="70" fill={sage} />
      <path d="M28 25h32M28 33h32M28 41h21" stroke={paper} strokeWidth="2" />
      <path d={signature} fill="none" stroke={ink} strokeWidth="2" />
      <path
        d={signature}
        fill="none"
        stroke={sand}
        strokeWidth="2.5"
        pathLength="1"
        opacity="0"
        className="pic-trace"
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
      <g className={revealOutput}>
        <rect x="54" y="28" width="29" height="42" fill={ink} />
        <path
          d="M61 40h15M61 47h15M61 54h10"
          stroke={paper}
          strokeWidth="2"
          className="pic-imprint"
        />
      </g>
      <path
        d="M36 77h15m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "word-to-pdf": (
    <>
      <rect x="13" y="22" width="35" height="46" fill={sage} />
      <path d="m20 35 3 17 5-11 5 11 5-17" fill="none" stroke={paper} strokeWidth="3" />
      <g className={revealOutput}>
        <rect x="54" y="28" width="29" height="42" fill={ink} />
        <path
          d="M61 40h15M61 47h15M61 54h10"
          stroke={paper}
          strokeWidth="2"
          className="pic-imprint"
        />
      </g>
      <path
        d="M36 77h15m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "markdown-to-word": (
    <>
      <g className={shiftLeft}>
        <rect x="12" y="18" width="35" height="48" fill={ink} />
        <path d="m19 30 4 18 5-11 5 11 5-18" fill="none" stroke={paper} strokeWidth="3" />
      </g>
      <path
        d="M44 43h12m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
      <g className={revealOutput}>
        <rect x="56" y="25" width="29" height="48" fill={sage} />
        <path
          d="M62 38h17M62 46h17M62 54h12"
          stroke={paper}
          strokeWidth="2"
          className="pic-imprint"
        />
      </g>
    </>
  ),
  "markdown-to-pdf": (
    <>
      <g className={shiftLeft}>
        <rect x="12" y="18" width="35" height="48" fill={ink} />
        <path d="m19 30 4 18 5-11 5 11 5-18" fill="none" stroke={paper} strokeWidth="3" />
      </g>
      <path
        d="M44 43h12m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
      <g className={revealOutput}>
        <path d="M60 18h18l8 8v49H60Z" fill={sage} />
        <path d="M78 18v10h8" fill="none" stroke={paper} strokeWidth="2" />
        <path
          d="M66 43h14M66 50h14M66 57h10"
          stroke={paper}
          strokeWidth="2"
          className="pic-imprint"
        />
      </g>
    </>
  ),
  "word-to-markdown": (
    <>
      <g className={shiftLeft}>
        <rect x="12" y="24" width="30" height="45" fill={sage} />
        <path d="m18 36 3 17 5-11 5 11 4-17" fill="none" stroke={paper} strokeWidth="3" />
      </g>
      <path
        d="M44 46h12m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
      <g className={revealOutput}>
        <rect x="56" y="18" width="30" height="52" fill={ink} />
        <g className="pic-imprint">
          <path d="M63 31h16M63 39h16M63 47h11" stroke={paper} strokeWidth="2" />
          <path d="M63 57h5l3 4 3-4h5" fill="none" stroke={sand} strokeWidth="2" />
        </g>
      </g>
    </>
  ),
  "pdf-to-markdown": (
    <>
      <g className={shiftLeft}>
        <path d="M12 18h25l9 9v48H12Z" fill={ink} />
        <path
          d="M37 18v11h9M19 43h18M19 50h18M19 57h13"
          fill="none"
          stroke={paper}
          strokeWidth="2"
        />
      </g>
      <path
        d="M44 49h12m-5-5 5 5-5 5"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
      <g className={revealOutput}>
        <rect x="57" y="23" width="29" height="48" fill={sage} />
        <path
          d="m63 36 3 14 4-9 4 9 4-14M63 57h17"
          fill="none"
          stroke={paper}
          strokeWidth="2"
          className="pic-imprint"
        />
      </g>
    </>
  ),
  "powerpoint-to-pdf": (
    <>
      <g className={shiftLeft}>
        <rect x="12" y="17" width="46" height="38" fill={sage} />
        <path d="M20 46h8V34h7v12h8V28h7v18" fill="none" stroke={paper} strokeWidth="3" />
        <path d="M12 55h46" stroke={paper} strokeWidth="2" />
      </g>
      <g className={revealOutput}>
        <rect x="51" y="34" width="31" height="45" fill={ink} stroke={paper} strokeWidth="3" />
        <path
          d="M59 46h15M59 53h15M59 60h10"
          stroke={paper}
          strokeWidth="2"
          className="pic-imprint"
        />
      </g>
      <path
        d="M30 77h16m-6-6 6 6-6 6"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "video-to-mp3": (
    <>
      <rect x="12" y="20" width="48" height="39" fill={sage} />
      <path d="m31 29 17 10-17 10Z" fill={paper} />
      <g>
        <circle cx="64" cy="60" r="20" fill={ink} stroke={paper} strokeWidth="3" />
        <circle cx="64" cy="60" r="12" fill="none" stroke={sage} strokeWidth="2" />
        <circle cx="64" cy="60" r="3" fill={sand} />
        <path
          d="M51 62a13 13 0 0 0 9 10m3-24a13 13 0 0 1 10 4"
          fill="none"
          stroke={paper}
          strokeWidth="2"
          opacity="0"
          className="pic-reveal"
        />
      </g>
      <path d="M75 38v15l-7 3" fill="none" stroke={sand} strokeWidth="3" className={shiftRightUp} />
    </>
  ),
  "video-to-gif": (
    <>
      <g className={shiftLeft}>
        <rect x="12" y="20" width="48" height="39" fill={sage} />
        <path d="m30 29 17 10-17 10Z" fill={paper} />
      </g>
      <g className="pic-reveal" opacity="0" fill="none" stroke={sage} strokeWidth="2">
        <path d="M46 74V40h35M41 69V35h34" />
      </g>
      <g className={revealOutput}>
        <rect x="47" y="45" width="38" height="36" fill={ink} stroke={paper} strokeWidth="3" />
        <path
          d="M55 56h20M55 63h14M55 70h17"
          stroke={sand}
          strokeWidth="3"
          className="pic-imprint"
        />
        <path d="M68 50h12v8" fill="none" stroke={sage} strokeWidth="3" />
      </g>
      <path
        d="M20 72h18m-6-6 6 6-6 6"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
    </>
  ),
  "qr-code": (
    <>
      <g>
        <rect x="15" y="15" width="28" height="28" fill={ink} />
        <rect x="21" y="21" width="16" height="16" fill={paper} />
        <rect x="25" y="25" width="8" height="8" fill={sage} />
        <rect x="53" y="15" width="28" height="28" fill={sand} />
        <rect x="59" y="21" width="16" height="16" fill={paper} />
        <rect x="63" y="25" width="8" height="8" fill={ink} />
        <rect x="15" y="53" width="28" height="28" fill={sage} />
        <rect x="21" y="59" width="16" height="16" fill={paper} />
        <rect x="25" y="63" width="8" height="8" fill={ink} />
      </g>
      <path d="M53 55h8v8h-8zm14 0h14v8H67zm-8 13h8v13h-8zm14-1h8v14h-8z" fill={ink} />
      <path d="M47 10v8m-4-4h8" stroke={sand} strokeWidth="2" className="pic-spark" />
      <g className="pic-scan" opacity="0">
        <g className="pic-scan-line">
          <path d="M11 15h74" stroke={paper} strokeWidth="4" />
          <path d="M11 15h74" stroke={sand} strokeWidth="2" />
        </g>
      </g>
    </>
  ),
  barcode: (
    <>
      <g className={shiftLeft}>
        <rect x="14" y="29" width="9" height="38" fill={ink} />
        <rect x="27" y="29" width="4" height="38" fill={ink} />
        <rect x="35" y="29" width="7" height="38" fill={ink} />
        <rect x="46" y="29" width="4" height="38" fill={ink} />
        <rect x="54" y="29" width="9" height="38" fill={ink} />
        <rect x="67" y="29" width="4" height="38" fill={ink} />
        <rect x="75" y="29" width="7" height="38" fill={ink} />
      </g>
      <path d="M14 74h68" stroke={sage} strokeWidth="2" />
      <g className="pic-scan" opacity="0">
        <g className="pic-scan-line">
          <path d="M10 32h76" stroke={paper} strokeWidth="4" />
          <path d="M10 32h76" stroke={sand} strokeWidth="2" />
        </g>
      </g>
    </>
  ),
  "image-to-text": (
    <>
      <g className={shiftLeft}>
        <rect x="13" y="17" width="52" height="60" fill={sage} />
        <rect x="19" y="24" width="40" height="34" fill={paper} />
        <path d="M24 32h30M24 39h24M24 46h28" stroke={ink} strokeWidth="2" />
      </g>
      <g className={revealOutput}>
        <rect x="53" y="41" width="30" height="38" fill={ink} stroke={paper} strokeWidth="3" />
        <path
          d="M60 50h16M60 57h11M60 64h14"
          stroke={sand}
          strokeWidth="3"
          className="pic-imprint"
        />
      </g>
      <path
        d="M45 30h11m-4-4 4 4-4 4"
        fill="none"
        stroke={sand}
        strokeWidth="3"
        className={transfer}
      />
      <g className="pic-scan" opacity="0">
        <g className="pic-scan-line">
          <path d="M10 20h76" stroke={paper} strokeWidth="4" />
          <path d="M10 20h76" stroke={sand} strokeWidth="2" />
        </g>
      </g>
    </>
  ),
  "social-media-downloader": (
    <>
      <rect x="16" y="16" width="47" height="43" fill={sage} />
      <path d="m34 26 16 11-16 11Z" fill={paper} />
      <g>
        <circle cx="65" cy="61" r="19" fill={sand} stroke={paper} strokeWidth="3" />
        <path
          d="M65 49v17m-7-7 7 7 7-7"
          fill="none"
          stroke={ink}
          strokeWidth="3"
          className="pictogram-part pic-download"
        />
        <path d="M56 72h18" stroke={ink} strokeWidth="3" />
        <path d="M56 72h18" stroke={paper} strokeWidth="2" opacity="0" className="pic-reveal" />
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
      <g className="pic-spark" fill="none" stroke={sand} strokeWidth="2" strokeLinecap="round">
        <path d="M13 19v10m-5-5h10" />
        <path d="M80 13v12m-6-6h12m-7 57 5 5m0-5-5 5" />
      </g>
    </svg>
  )
}
