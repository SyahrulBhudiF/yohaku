import { Layer } from "effect"

import { ImageProcessor } from "./image-processor"

// Browsers run the codecs in a Worker; Node tests and workerd use the direct path.
const processor = typeof Worker === "undefined" ? ImageProcessor.layer : ImageProcessor.workerLayer

export const AllServicesLive = Layer.mergeAll(processor)
