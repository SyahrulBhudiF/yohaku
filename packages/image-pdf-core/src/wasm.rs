use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn build_pdf(data: &[u8], lengths: &[u32], formats: &[u8], page_size: &str) -> Vec<u8> {
    crate::build_pdf(data, lengths, formats, page_size).unwrap_or_default()
}
