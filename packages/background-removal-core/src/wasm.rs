use wasm_bindgen::prelude::*;
use wasm_bindgen::Clamped;

#[wasm_bindgen]
pub fn remove_background(data: &[u8], width: u32, height: u32) -> Clamped<Vec<u8>> {
    Clamped(crate::remove_background(data, width, height))
}
