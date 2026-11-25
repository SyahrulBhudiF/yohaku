import { Layer } from "effect"

import { ImageProcessor } from "./image-processor"
import { PdfProcessor } from "./pdf-processor"
import { PdfOcr } from "./pdf-ocr"

// Browsers run the codecs in a Worker; Node tests and workerd use the direct path.
const processor = typeof Worker === "undefined" ? ImageProcessor.layer : ImageProcessor.workerLayer

export const AllServicesLive = Layer.mergeAll(processor, PdfProcessor.layer, PdfOcr.layer)
