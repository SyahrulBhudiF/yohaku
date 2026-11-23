mod decode;
mod layout;
mod render;

#[cfg(target_arch = "wasm32")]
mod wasm;

pub use render::build_pdf;
