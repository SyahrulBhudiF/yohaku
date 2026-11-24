//! Browser-side metadata resolution for public YouTube, Instagram, and Facebook videos.

#[cfg(any(target_arch = "wasm32", test))]
mod facebook;

#[cfg(target_arch = "wasm32")]
mod resolver;
#[cfg(target_arch = "wasm32")]
mod transport;

#[cfg(target_arch = "wasm32")]
pub use resolver::MediaResolver;
