declare module "imagetracerjs" {
  export interface ImageTracerOptions {
    numberofcolors?: number
    colorquantcycles?: number
    pathomit?: number
    ltres?: number
    qtres?: number
    strokewidth?: number
    blurradius?: number
    blurdelta?: number
    rightangleenhance?: boolean
    linefilter?: boolean
    scale?: number
    roundcoords?: number
    viewbox?: boolean
    desc?: boolean
    layering?: number
  }

  export interface ImageDataLike {
    readonly data: Uint8ClampedArray
    readonly width: number
    readonly height: number
  }

  export interface ImageTracer {
    imagedataToSVG: (imageData: ImageDataLike, options?: string | ImageTracerOptions) => string
  }

  const ImageTracer: ImageTracer

  export default ImageTracer
}
