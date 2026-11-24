use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn convert_docx_to_pdf(bytes: &[u8]) -> Result<Vec<u8>, JsValue> {
    crate::conversion::convert(bytes).map_err(|error| JsValue::from_str(&error))
}
