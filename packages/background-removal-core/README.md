# background-removal-core

Fast, non-AI background removal for uniform studio backgrounds.

The core samples the image border for a background colour, grows a
border-connected mask within a sampled colour tolerance, feathers the matte with
a one-pixel box blur, and de-spills edge pixels against the background colour.
It returns a new RGBA buffer; the browser decodes and encodes the PNG.

This is a colour-key matte, not a semantic segmenter. It is fast and predictable
for product/studio shots with a uniform border. Complex scenes need a trimap
(GrabCut/closed-form matting) or a learned model.

Build the browser package with `pnpm wasm:build`; run the native tests with
`pnpm wasm:test`.
