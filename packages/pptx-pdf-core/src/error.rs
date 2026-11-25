use std::fmt;

use crate::limits::{
    MAX_IMAGES, MAX_IMAGE_PIXELS, MAX_PART_BYTES, MAX_SHAPES, MAX_SLIDES, MAX_TABLE_CELLS,
    MAX_TEXT_BYTES, MAX_UNCOMPRESSED_BYTES,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConvertError {
    InvalidPresentation,
    EncryptedPresentation,
    NoSlides,
    TooManySlides,
    TooManyShapes,
    TooManyTableCells,
    TooManyImages,
    ImageTooLarge,
    PartTooLarge,
    PresentationTooLarge,
    TextTooLarge,
    PdfWriteFailed,
}

impl ConvertError {
    pub fn message(self) -> String {
        match self {
            Self::InvalidPresentation => "This file is not a readable .pptx presentation.".into(),
            Self::EncryptedPresentation => {
                "This presentation is password-protected. Remove the password and save it as .pptx."
                    .into()
            }
            Self::NoSlides => "This presentation has no slides.".into(),
            Self::TooManySlides => {
                format!("Presentations can have at most {MAX_SLIDES} slides.")
            }
            Self::TooManyShapes => {
                format!("This presentation has too many shapes to render (limit {MAX_SHAPES}).")
            }
            Self::TooManyTableCells => {
                format!("This presentation has too many table cells to render (limit {MAX_TABLE_CELLS}).")
            }
            Self::TooManyImages => {
                format!("This presentation has more than {MAX_IMAGES} images.")
            }
            Self::ImageTooLarge => format!(
                "An image in this presentation is larger than {} megapixels.",
                MAX_IMAGE_PIXELS / 1_000_000
            ),
            Self::PartTooLarge => {
                format!(
                    "A part of this presentation is larger than {} MB.",
                    MAX_PART_BYTES / 1024 / 1024
                )
            }
            Self::PresentationTooLarge => format!(
                "This presentation expands to more than {} MB.",
                MAX_UNCOMPRESSED_BYTES / 1024 / 1024
            ),
            Self::TextTooLarge => {
                format!(
                    "This presentation has more than {} MB of text.",
                    MAX_TEXT_BYTES / 1024 / 1024
                )
            }
            Self::PdfWriteFailed => "The PDF could not be written.".into(),
        }
    }
}

impl fmt::Display for ConvertError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message())
    }
}

impl std::error::Error for ConvertError {}

pub type Result<T> = std::result::Result<T, ConvertError>;
