import type { ImageFormat } from "@/libs/schemas/image"
import type { ResizeOptions } from "@/libs/utils/image-resize"

export interface TranscodeRequest {
  readonly type: "transcode"
  readonly id: number
  readonly bytes: Uint8Array
  readonly format: ImageFormat
  readonly quality: number
  readonly maxSide?: number
  readonly preview?: boolean
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

export interface ResizeRequest {
  readonly type: "resize"
  readonly id: number
  readonly bytes: Uint8Array
  readonly options: ResizeOptions
  readonly format: ImageFormat
  readonly quality: number
}

export interface PreloadRequest {
  readonly type: "preload"
  readonly format: ImageFormat
}

export interface MeasureRequest {
  readonly type: "measure"
  readonly id: number
  readonly bytes: Uint8Array
}

export type WorkerRequest =
  | TranscodeRequest
  | EncodeRequest
  | ResizeRequest
  | MeasureRequest
  | PreloadRequest

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

export type ResizeResponse =
  | {
      readonly type: "resize"
      readonly id: number
      readonly ok: true
      readonly data: Uint8Array<ArrayBuffer>
      readonly format: ImageFormat
      readonly width: number
      readonly height: number
    }
  | {
      readonly type: "resize"
      readonly id: number
      readonly ok: false
      readonly message: string
    }

export type MeasureResponse =
  | {
      readonly type: "measure"
      readonly id: number
      readonly ok: true
      readonly width: number
      readonly height: number
    }
  | {
      readonly type: "measure"
      readonly id: number
      readonly ok: false
      readonly message: string
    }

export type WorkerResponse = TranscodeResponse | EncodeResponse | ResizeResponse | MeasureResponse
