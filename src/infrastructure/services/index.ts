import { Layer } from "effect"

import { ImageProcessor } from "./image-processor"

export const AllServicesLive = Layer.mergeAll(ImageProcessor.layer)
