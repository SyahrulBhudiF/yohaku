import type { ImageFormat } from "@/libs/schemas/image"

export interface TranscodeRequest {
  readonly type: "transcode"
  readonly id: number
  readonly bytes: Uint8Array
  readonly format: ImageFormat
  readonly quality: number
}

export interface PreloadRequest {
  readonly type: "preload"
  readonly format: ImageFormat
}

export type WorkerRequest = TranscodeRequest | PreloadRequest

export type TranscodeResponse =
  | {
      readonly type: "transcode"
      readonly id: number
      readonly ok: true
      readonly data: Uint8Array<ArrayBuffer>
      readonly format: ImageFormat
    }
  | {
      readonly type: "transcode"
      readonly id: number
      readonly ok: false
      readonly message: string
    }
