use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn convert_pptx_to_pdf(bytes: &[u8]) -> Result<Vec<u8>, JsValue> {
    crate::convert(bytes).map_err(|error| JsValue::from_str(&error.message()))
}
