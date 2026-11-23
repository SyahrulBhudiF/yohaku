use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn remove_background(data: &[u8], width: u32, height: u32) -> Vec<u8> {
    crate::remove_background(data, width, height)
}
