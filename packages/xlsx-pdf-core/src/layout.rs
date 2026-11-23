use soa_rs::{Soa, Soars};

use crate::error::ConvertError;
use crate::limits::{MARGIN, TABLE_OFFSET};
use crate::model::{PageFormat, SheetData};

#[derive(Soars, Clone, Copy)]
pub(crate) struct Column {
    pub width: f32,
    pub x_offset: f32,
}

pub(crate) struct SheetLayout {
    pub columns: Soa<Column>,
    pub table_width: f32,
    pub font_size: f32,
    pub row_height: f32,
    pub data_per_page: usize,
    pub pages: usize,
}

pub(crate) fn page_format(
    page_size: &str,
    orientation: &str,
) -> std::result::Result<PageFormat, ConvertError> {
    let (short, long) = match page_size {
        "a4" => (595.28, 841.89),
        "letter" => (612.0, 792.0),
        _ => return Err(ConvertError::InvalidPageSize),
    };

    match orientation {
        "portrait" => Ok(PageFormat {
            width: short,
            height: long,
        }),
        "landscape" => Ok(PageFormat {
            width: long,
            height: short,
        }),
        _ => Err(ConvertError::InvalidOrientation),
    }
}

pub(crate) fn layout_sheet(sheet: &SheetData, format: &PageFormat) -> SheetLayout {
    let cols = sheet.cols.max(1);
    let font_size = if cols <= 10 {
        7.5
    } else if cols <= 16 {
        6.5
    } else {
        5.5
    };
    let row_height = font_size + 5.0;
    let table_top = format.height - TABLE_OFFSET;
    let rows_capacity = ((table_top - MARGIN) / row_height).floor().max(1.0) as usize;
    let header_rows = if sheet.has_header { 1 } else { 0 };
    let data_per_page = rows_capacity.saturating_sub(header_rows).max(1);
    let data_rows = sheet.data_rows();
    let pages = if data_rows == 0 {
        1
    } else {
        data_rows.div_ceil(data_per_page)
    };
    let available = format.width - MARGIN * 2.0;
    let mut weights = vec![4.0f32; cols];

    for (index, width) in sheet.widths.iter().enumerate().take(cols) {
        weights[index] = (*width as f32).clamp(4.0, 32.0);
    }

    let total_weight: f32 = weights.iter().sum();
    let mut widths: Vec<f32> = weights
        .iter()
        .map(|weight| (available * weight / total_weight).max(18.0))
        .collect();
    let width_sum: f32 = widths.iter().sum();

    if width_sum > available {
        let scale = available / width_sum;

        for width in &mut widths {
            *width *= scale;
        }
    }

    let mut columns: Soa<Column> = Soa::with_capacity(cols);
    let mut x = MARGIN;

    for width in widths {
        columns.push(Column { width, x_offset: x });
        x += width;
    }

    SheetLayout {
        table_width: x - MARGIN,
        columns,
        font_size,
        row_height,
        data_per_page,
        pages,
    }
}
