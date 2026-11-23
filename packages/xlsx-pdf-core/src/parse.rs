use std::borrow::Cow;
use std::io::Cursor;

use calamine::{Data, Reader, Xlsx};

use crate::error::{ConvertError, Result};
use crate::limits::MAX_ROWS;
use crate::model::{SheetData, Span, TextArena};

fn cell_text(data: &Data) -> Cow<'_, str> {
    match data {
        Data::Empty => Cow::Borrowed(""),
        Data::String(value) => {
            let trimmed = value.trim();

            if trimmed.contains('\n') || trimmed.contains('\r') {
                Cow::Owned(trimmed.replace(['\n', '\r'], " "))
            } else {
                Cow::Borrowed(trimmed)
            }
        }
        Data::Float(value) => {
            if value.is_finite() && value.fract() == 0.0 && value.abs() < 1e15 {
                Cow::Owned(format!("{}", *value as i64))
            } else {
                let text = format!("{value:.2}");

                Cow::Owned(text.trim_end_matches('0').trim_end_matches('.').to_string())
            }
        }
        Data::Int(value) => Cow::Owned(value.to_string()),
        Data::Bool(value) => Cow::Borrowed(if *value { "TRUE" } else { "FALSE" }),
        Data::DateTime(value) => Cow::Owned(value.to_string()),
        Data::DateTimeIso(value) => Cow::Borrowed(value.trim()),
        Data::DurationIso(value) => Cow::Borrowed(value.trim()),
        Data::Error(value) => Cow::Owned(format!("#{value:?}")),
    }
}

pub(crate) fn parse_workbook(bytes: &[u8]) -> Result<Vec<SheetData>> {
    let mut workbook = Xlsx::new(Cursor::new(bytes)).map_err(|_| ConvertError::InvalidWorkbook)?;
    let names = workbook.sheet_names();
    let mut sheets = Vec::new();
    let mut total_rows = 0usize;

    for name in names {
        let range = match workbook.worksheet_range(&name) {
            Ok(range) => range,
            Err(_) => continue,
        };
        let cols = range.width();

        if cols == 0 {
            continue;
        }

        let mut arena = TextArena::new();
        let mut cells = Vec::with_capacity(range.height() * cols);
        let mut widths = vec![0u16; cols];
        let mut row_count = 0usize;

        for row in range.rows() {
            for (column, value) in row.iter().enumerate().take(cols) {
                let text = cell_text(value);
                let span = arena.push(&text);
                let width = text.chars().count().min(32) as u16;

                if width > widths[column] {
                    widths[column] = width;
                }

                cells.push(span);
            }

            for _ in row.len().min(cols)..cols {
                cells.push(Span::default());
            }

            row_count += 1;
        }

        while row_count > 0 {
            let start = (row_count - 1) * cols;
            let empty = cells[start..start + cols].iter().all(|span| span.len == 0);

            if !empty {
                break;
            }

            row_count -= 1;
        }

        cells.truncate(row_count * cols);

        if row_count == 0 {
            continue;
        }

        let has_header = cells[..cols].iter().any(|span| span.len > 0);
        let data_start = if has_header { 1 } else { 0 };
        let data_rows = row_count - data_start;

        if data_rows == 0 && !has_header {
            continue;
        }

        total_rows += data_rows;

        if total_rows > MAX_ROWS {
            return Err(ConvertError::TooManyRows);
        }

        sheets.push(SheetData {
            name,
            arena,
            cells,
            row_count,
            cols,
            has_header,
            widths,
        });
    }

    if sheets.is_empty() {
        return Err(ConvertError::NoSheets);
    }

    Ok(sheets)
}
