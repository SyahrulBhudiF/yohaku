//! Browser-side metadata resolution for public YouTube and Instagram videos.

#[cfg(target_arch = "wasm32")]
mod resolver;
#[cfg(target_arch = "wasm32")]
mod transport;

#[cfg(target_arch = "wasm32")]
pub use resolver::MediaResolver;
