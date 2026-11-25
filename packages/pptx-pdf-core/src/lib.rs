//! PPTX → PDF conversion for Yohaku.
//!
//! The public [`convert`] function reads an OOXML presentation package and
//! writes one PDF page per slide. The browser entry point is
//! `convert_pptx_to_pdf` behind the `wasm32` target.
//!
//! The renderer covers the parts of PresentationML that decks use for
//! everyday slides: slide size and order, solid backgrounds, preset shapes,
//! solid and gradient fills, lines, images with cropping and alpha, tables,
//! and styled text runs. Charts, SmartArt, 3D transforms, embedded video,
//! animations, and legacy `.ppt` files are not rendered.

mod color;
mod error;
mod image;
mod limits;
mod model;
mod package;
mod parse;
mod render;
mod text;

pub use error::{ConvertError, Result};

pub fn convert(bytes: &[u8]) -> Result<Vec<u8>> {
    let deck = parse::parse(bytes)?;

    render::render(&deck)
}

#[cfg(target_arch = "wasm32")]
mod wasm;
