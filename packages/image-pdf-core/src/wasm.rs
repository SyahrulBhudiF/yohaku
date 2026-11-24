use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn build_pdf(
    data: &[u8],
    lengths: &[u32],
    formats: &[u8],
    page_size: &str,
) -> std::result::Result<Vec<u8>, JsValue> {
    crate::build_pdf(data, lengths, formats, page_size)
        .map_err(|message| JsValue::from_str(&message))
}
