//! XLSX → PDF conversion for Yohaku.
//!
//! The public [`convert`] function parses an XLSX workbook and writes a
//! compressed, printable PDF table. The browser entry point is the
//! `convert_xlsx_to_pdf` function behind the `wasm32` target.

mod error;
mod layout;
mod limits;
mod model;
mod parse;
mod render;

pub use error::{ConvertError, Result};

/// Convert an XLSX workbook into a PDF.
///
/// `page_size` is `"a4"` or `"letter"`; `orientation` is `"landscape"` or
/// `"portrait"`. The first non-empty row of each sheet is treated as a header
/// and repeated on every page.
pub fn convert(bytes: &[u8], page_size: &str, orientation: &str) -> Result<Vec<u8>> {
    let format = layout::page_format(page_size, orientation)?;
    let sheets = parse::parse_workbook(bytes)?;

    render::render_pdf(&sheets, format)
}

#[cfg(target_arch = "wasm32")]
mod wasm;
