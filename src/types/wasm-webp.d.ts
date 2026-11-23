declare module "wasm-webp/dist/esm/index.js" {
  export interface WebPAnimationFrame {
    readonly data: Uint8Array
    readonly duration: number
    readonly config?: {
      readonly lossless: number
      readonly quality: number
    }
  }

  export interface DecodedWebPAnimationFrame extends WebPAnimationFrame {
    readonly width: number
    readonly height: number
  }

  export const encodeAnimation: (
    width: number,
    height: number,
    hasAlpha: boolean,
    frames: ReadonlyArray<WebPAnimationFrame>,
  ) => Promise<Uint8Array | null>

  export const decodeAnimation: (
    data: Uint8Array,
    hasAlpha: boolean,
  ) => Promise<ReadonlyArray<DecodedWebPAnimationFrame> | null>
}
