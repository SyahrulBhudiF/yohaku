use std::fmt;

use crate::limits::{MAX_PAGES, MAX_ROWS};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConvertError {
    InvalidPageSize,
    InvalidOrientation,
    InvalidWorkbook,
    NoSheets,
    TooManyRows,
    TooManyPages,
}

impl ConvertError {
    pub fn message(self) -> String {
        match self {
            Self::InvalidPageSize => "Choose a supported page size.".into(),
            Self::InvalidOrientation => "Choose a supported page orientation.".into(),
            Self::InvalidWorkbook => "This file is not a readable .xlsx workbook.".into(),
            Self::NoSheets => "This workbook has no readable sheets.".into(),
            Self::TooManyRows => {
                format!("This workbook has more than {MAX_ROWS} rows. Split it before converting.")
            }
            Self::TooManyPages => {
                format!("This workbook would create more than {MAX_PAGES} PDF pages.")
            }
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
