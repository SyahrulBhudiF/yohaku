import { create } from "zustand"

import type { PdfFileEntry } from "@/features/pdf-tools/store"
import type { SignaturePlacement } from "./process"

export interface Signature {
  id: string
  url: string
  png: Uint8Array
  aspect: number
}

export interface PlacedSignature extends SignaturePlacement {
  id: string
  url: string
}

interface SignState {
  file: PdfFileEntry | null
  page: number
  signatures: Signature[]
  placements: PlacedSignature[]
  selected: string | null
  revision: number
}

export const useSignStore = create<SignState>(() => ({
  file: null,
  page: 1,
  signatures: [],
  placements: [],
  selected: null,
  revision: 0,
}))
