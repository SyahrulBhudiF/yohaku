use std::borrow::Cow;
use std::io::Write;

use encoding_rs::WINDOWS_1252;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use pdf_writer::{Content, Filter, Finish, Name, Pdf, Rect, Ref, Str};

use crate::error::{ConvertError, Result};
use crate::layout::layout_sheet;
use crate::limits::{MARGIN, MAX_PAGES, TABLE_OFFSET, TITLE_OFFSET};
use crate::model::{PageFormat, SheetData};

fn winansi(text: &str) -> Cow<'_, [u8]> {
    if text.is_ascii() {
        return Cow::Borrowed(text.as_bytes());
    }

    let (encoded, _, had_errors) = WINDOWS_1252.encode(text);

    if !had_errors {
        return encoded;
    }

    let mut output = Vec::with_capacity(text.len());

    for character in text.chars() {
        let mut buffer = [0u8; 4];
        let (bytes, _, failed) = WINDOWS_1252.encode(character.encode_utf8(&mut buffer));

        if failed {
            output.push(b'?');
        } else {
            output.extend_from_slice(&bytes);
        }
    }

    Cow::Owned(output)
}

fn truncate_for_width(text: &str, width: f32, font_size: f32) -> Cow<'_, str> {
    let max_chars = ((width - 4.0) / (font_size * 0.52)).floor().max(1.0) as usize;

    if text.chars().count() <= max_chars {
        return Cow::Borrowed(text);
    }

    let mut output: String = text.chars().take(max_chars.saturating_sub(2)).collect();

    output.push_str("..");

    Cow::Owned(output)
}

fn compress(data: &[u8]) -> Vec<u8> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());

    encoder.write_all(data).expect("compress");
    encoder.finish().expect("finish compression")
}

pub(crate) fn render_pdf(sheets: &[SheetData], format: PageFormat) -> Result<Vec<u8>> {
    let layouts: Vec<_> = sheets
        .iter()
        .map(|sheet| layout_sheet(sheet, &format))
        .collect();
    let total_pages: usize = layouts.iter().map(|layout| layout.pages).sum();

    if total_pages > MAX_PAGES {
        return Err(ConvertError::TooManyPages);
    }

    let catalog_id = Ref::new(1);
    let pages_id = Ref::new(2);
    let regular_font_id = Ref::new(3);
    let bold_font_id = Ref::new(4);
    let regular_font_name = Name(b"F1");
    let bold_font_name = Name(b"F2");
    let mut next_id = 5i32;
    let mut page_ids = Vec::with_capacity(total_pages);
    let mut page_contents = Vec::with_capacity(total_pages);
    let table_top = format.height - TABLE_OFFSET;
    let title_y = format.height - TITLE_OFFSET;

    for (sheet, layout) in sheets.iter().zip(layouts.iter()) {
        let data_start = sheet.data_start();
        let data_rows = sheet.data_rows();
        let widths = layout.columns.width();
        let x_offsets = layout.columns.x_offset();

        for page_index in 0..layout.pages {
            let page_id = Ref::new(next_id);
            let content_id = Ref::new(next_id + 1);
            next_id += 2;

            let start = page_index * layout.data_per_page;
            let end = (start + layout.data_per_page).min(data_rows);
            let mut content = Content::new();

            content.set_fill_rgb(0.08, 0.09, 0.11);

            if sheet.has_header {
                content.set_fill_rgb(0.94, 0.95, 0.97);
                content.rect(
                    MARGIN,
                    table_top - 3.0,
                    layout.table_width,
                    layout.row_height,
                );
                content.fill_nonzero();
                content.set_fill_rgb(0.08, 0.09, 0.11);
                content.set_stroke_rgb(0.78, 0.79, 0.82);
                content.set_line_width(0.5);
                content.move_to(MARGIN, table_top - 3.0);
                content.line_to(MARGIN + layout.table_width, table_top - 3.0);
                content.stroke();
            }

            content.begin_text();
            content.set_font(bold_font_name, 9.0);
            content.set_text_matrix([1.0, 0.0, 0.0, 1.0, MARGIN, title_y]);
            let title = if page_index == 0 {
                format!("{} · {} rows", sheet.name, data_rows)
            } else {
                format!("{} · continued", sheet.name)
            };
            let title = truncate_for_width(&title, format.width - MARGIN * 2.0, 9.0);
            let encoded = winansi(&title);

            content.show(Str(encoded.as_ref()));

            if sheet.has_header {
                content.set_font(bold_font_name, layout.font_size);

                for column in 0..sheet.cols {
                    let text = sheet.cell(0, column);

                    if text.is_empty() {
                        continue;
                    }

                    let text = truncate_for_width(text, widths[column], layout.font_size);
                    let encoded = winansi(&text);
                    let x = x_offsets[column];

                    content.set_text_matrix([1.0, 0.0, 0.0, 1.0, x, table_top]);
                    content.show(Str(encoded.as_ref()));
                }
            }

            content.set_font(regular_font_name, layout.font_size);

            for row_index in start..end {
                let sheet_row = data_start + row_index;
                let y = if sheet.has_header {
                    table_top - layout.row_height * ((row_index - start) as f32 + 1.0)
                } else {
                    table_top - layout.row_height * (row_index - start) as f32
                };

                for column in 0..sheet.cols {
                    let text = sheet.cell(sheet_row, column);

                    if text.is_empty() {
                        continue;
                    }

                    let text = truncate_for_width(text, widths[column], layout.font_size);
                    let encoded = winansi(&text);
                    let x = x_offsets[column];

                    content.set_text_matrix([1.0, 0.0, 0.0, 1.0, x, y]);
                    content.show(Str(encoded.as_ref()));
                }
            }

            content.end_text();
            page_ids.push(page_id);
            page_contents.push((content_id, compress(&content.finish())));
        }
    }

    let mut pdf = Pdf::new();

    pdf.catalog(catalog_id).pages(pages_id);
    pdf.pages(pages_id)
        .kids(page_ids.iter().copied())
        .count(page_ids.len() as i32);
    pdf.type1_font(regular_font_id)
        .base_font(Name(b"Helvetica"))
        .encoding_predefined(Name(b"WinAnsiEncoding"));
    pdf.type1_font(bold_font_id)
        .base_font(Name(b"Helvetica-Bold"))
        .encoding_predefined(Name(b"WinAnsiEncoding"));

    for (page_id, (content_id, content)) in page_ids.iter().zip(page_contents.iter()) {
        let mut page = pdf.page(*page_id);

        page.parent(pages_id)
            .media_box(Rect::new(0.0, 0.0, format.width, format.height))
            .contents(*content_id);
        page.resources()
            .fonts()
            .pair(regular_font_name, regular_font_id)
            .pair(bold_font_name, bold_font_id);
        page.finish();
        pdf.stream(*content_id, content).filter(Filter::FlateDecode);
    }

    Ok(pdf.finish())
}
