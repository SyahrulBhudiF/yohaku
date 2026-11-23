use wasm_bindgen::prelude::*;

use crate::convert;

#[wasm_bindgen]
pub fn convert_xlsx_to_pdf(
    bytes: &[u8],
    page_size: &str,
    orientation: &str,
) -> std::result::Result<Vec<u8>, JsValue> {
    convert(bytes, page_size, orientation).map_err(|error| JsValue::from_str(&error.to_string()))
}
