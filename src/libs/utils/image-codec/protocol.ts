import type { ImageFormat } from "@/libs/schemas/image"

export interface TranscodeRequest {
  readonly type: "transcode"
  readonly id: number
  readonly bytes: Uint8Array
  readonly format: ImageFormat
  readonly quality: number
}

export interface EncodeRequest {
  readonly type: "encode"
  readonly id: number
  readonly data: Uint8ClampedArray<ArrayBuffer>
  readonly width: number
  readonly height: number
  readonly format: ImageFormat
  readonly quality: number
}

export interface PreloadRequest {
  readonly type: "preload"
  readonly format: ImageFormat
}

export type WorkerRequest = TranscodeRequest | EncodeRequest | PreloadRequest

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

export type EncodeResponse =
  | {
      readonly type: "encode"
      readonly id: number
      readonly ok: true
      readonly data: Uint8Array<ArrayBuffer>
      readonly format: ImageFormat
    }
  | {
      readonly type: "encode"
      readonly id: number
      readonly ok: false
      readonly message: string
    }

export type WorkerResponse = TranscodeResponse | EncodeResponse
