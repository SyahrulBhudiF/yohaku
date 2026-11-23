mod color;
mod matte;

#[cfg(target_arch = "wasm32")]
mod wasm;

pub use matte::remove_background;
