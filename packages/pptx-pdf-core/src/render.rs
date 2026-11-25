use std::borrow::Cow;
use std::collections::HashMap;
use std::f32::consts::PI;
use std::io::Write;

use encoding_rs::WINDOWS_1252;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use pdf_writer::{Content, Filter, Finish, Name, Pdf, Rect, Ref, Str};

use crate::error::Result;
use crate::image::decode;
use crate::model::{
    Align, Anchor, Bullet, Cell, Color, Deck, FontFamily, Geometry, LineStyle, Shape, Table,
    TextBox,
};

const FONT_BASES: [&[u8]; 12] = [
    b"Helvetica",
    b"Helvetica-Bold",
    b"Helvetica-Oblique",
    b"Helvetica-BoldOblique",
    b"Times-Roman",
    b"Times-Bold",
    b"Times-Italic",
    b"Times-BoldItalic",
    b"Courier",
    b"Courier-Bold",
    b"Courier-Oblique",
    b"Courier-BoldOblique",
];
const FONT_NAMES: [&[u8]; 12] = [
    b"F1", b"F2", b"F3", b"F4", b"F5", b"F6", b"F7", b"F8", b"F9", b"F10", b"F11", b"F12",
];
const ALPHA_NAMES: [&[u8]; 11] = [
    b"GS0", b"GS1", b"GS2", b"GS3", b"GS4", b"GS5", b"GS6", b"GS7", b"GS8", b"GS9", b"GS10",
];

const HELVETICA_WIDTHS: [u16; 95] = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
    611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
    222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const HELVETICA_BOLD_WIDTHS: [u16; 95] = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
    611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
    278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

struct ImageRef {
    id: Ref,
}

#[derive(Clone)]
struct TextStyle {
    size: f32,
    bold: bool,
    italic: bool,
    underline: bool,
    color: Color,
    font: FontFamily,
}

struct Segment {
    start: u32,
    len: u32,
    width: f32,
    style: TextStyle,
}

struct Line {
    segments: Vec<Segment>,
    width: f32,
    size: f32,
    bullet: Option<Bullet>,
    level: u8,
    margin_left: f32,
    indent: f32,
    space_before: f32,
    space_after: f32,
    line_spacing: f32,
    align: Align,
}

pub fn render(deck: &Deck) -> Result<Vec<u8>> {
    let mut pdf = Pdf::new();
    let catalog_id = Ref::new(1);
    let pages_id = Ref::new(2);
    let mut next_id = 3i32;
    let font_ids = create_fonts(&mut pdf, &mut next_id);
    let alpha_ids = create_alpha_states(&mut pdf, &mut next_id);
    let mut image_refs: HashMap<u32, Option<ImageRef>> = HashMap::new();
    let mut page_ids = Vec::with_capacity(deck.slides.len());

    for slide in &deck.slides {
        let page_id = Ref::new(next_id);
        let content_id = Ref::new(next_id + 1);
        next_id += 2;

        let start = slide.shape_start as usize;
        let end = start + slide.shape_count as usize;
        let shapes = &deck.shapes[start..end];
        let mut used_images: Vec<u32> = Vec::new();

        for shape in shapes {
            if let Some(index) = shape.image {
                if !used_images.contains(&index) {
                    used_images.push(index);
                    ensure_image(&mut pdf, deck, index, &mut next_id, &mut image_refs);
                }
            }
        }

        let mut content = Content::new();

        content.set_fill_rgb(
            f32::from(slide.background.r) / 255.0,
            f32::from(slide.background.g) / 255.0,
            f32::from(slide.background.b) / 255.0,
        );
        content.rect(0.0, 0.0, deck.width, deck.height);
        content.fill_nonzero();

        for shape in shapes {
            draw_shape(&mut content, deck, shape, &image_refs);
        }

        let mut page = pdf.page(page_id);

        page.parent(pages_id)
            .media_box(Rect::new(0.0, 0.0, deck.width, deck.height))
            .contents(content_id);

        {
            let mut resources = page.resources();
            {
                let mut fonts = resources.fonts();

                for (name, id) in FONT_NAMES.iter().zip(font_ids.iter()) {
                    fonts.pair(Name(name), *id);
                }
            }
            {
                let mut states = resources.ext_g_states();

                for (name, id) in ALPHA_NAMES.iter().zip(alpha_ids.iter()) {
                    states.pair(Name(name), *id);
                }
            }

            if !used_images.is_empty() {
                let mut x_objects = resources.x_objects();

                for index in &used_images {
                    if let Some(Some(image)) = image_refs.get(index) {
                        let name = format!("Im{index}");

                        x_objects.pair(Name(name.as_bytes()), image.id);
                    }
                }
            }
        }

        page.finish();

        let stream = compress(&content.finish());

        pdf.stream(content_id, &stream).filter(Filter::FlateDecode);
        page_ids.push(page_id);
    }

    pdf.catalog(catalog_id).pages(pages_id);
    pdf.pages(pages_id)
        .kids(page_ids.iter().copied())
        .count(page_ids.len() as i32);

    Ok(pdf.finish())
}

fn create_alpha_states(pdf: &mut Pdf, next_id: &mut i32) -> Vec<Ref> {
    (0..=10)
        .map(|step| {
            let id = Ref::new(*next_id);
            let alpha = step as f32 / 10.0;
            let mut state = pdf.ext_graphics(id);

            *next_id += 1;
            state
                .non_stroking_alpha(alpha)
                .stroking_alpha(alpha)
                .finish();

            id
        })
        .collect()
}

fn apply_alpha(content: &mut Content, alpha: f32) {
    let step = (alpha.clamp(0.0, 1.0) * 10.0).round() as usize;

    content.set_parameters(Name(ALPHA_NAMES[step]));
}

fn create_fonts(pdf: &mut Pdf, next_id: &mut i32) -> Vec<Ref> {
    FONT_BASES
        .iter()
        .map(|base| {
            let id = Ref::new(*next_id);

            *next_id += 1;

            let mut font = pdf.type1_font(id);

            font.base_font(Name(base))
                .encoding_predefined(Name(b"WinAnsiEncoding"))
                .finish();

            id
        })
        .collect()
}

fn compress(data: &[u8]) -> Vec<u8> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());

    encoder.write_all(data).expect("compress");
    encoder.finish().expect("finish compression")
}

fn ensure_image(
    pdf: &mut Pdf,
    deck: &Deck,
    index: u32,
    next_id: &mut i32,
    refs: &mut HashMap<u32, Option<ImageRef>>,
) {
    if refs.contains_key(&index) {
        return;
    }

    let Some(span) = deck.media_spans.get(index as usize) else {
        refs.insert(index, None);

        return;
    };
    let start = span.start as usize;
    let end = start + span.len as usize;
    let Some(bytes) = deck.media.get(start..end) else {
        refs.insert(index, None);

        return;
    };
    let Ok(image) = decode(bytes, span.format) else {
        refs.insert(index, None);

        return;
    };
    let id = Ref::new(*next_id);

    *next_id += 1;

    let smask_id = image.alpha.as_ref().map(|_| {
        let id = Ref::new(*next_id);

        *next_id += 1;

        id
    });

    let (filter, encoded): (Filter, Cow<'_, [u8]>) = match &image.jpeg {
        Some(jpeg) => (Filter::DctDecode, Cow::Borrowed(jpeg)),
        None => (Filter::FlateDecode, Cow::Owned(compress(&image.rgb))),
    };
    let mut xobject = pdf.image_xobject(id, &encoded);

    xobject.filter(filter);
    xobject.width(image.width as i32);
    xobject.height(image.height as i32);
    xobject.bits_per_component(8);

    if image.gray {
        xobject.color_space().device_gray();
    } else {
        xobject.color_space().device_rgb();
    }

    if let Some(smask_id) = smask_id {
        xobject.s_mask(smask_id);
    }

    xobject.finish();

    if let (Some(smask_id), Some(alpha)) = (smask_id, &image.alpha) {
        let encoded = compress(alpha);
        let mut mask = pdf.image_xobject(smask_id, &encoded);

        mask.filter(Filter::FlateDecode);
        mask.width(image.width as i32);
        mask.height(image.height as i32);
        mask.color_space().device_gray();
        mask.bits_per_component(8);
        mask.finish();
    }

    refs.insert(index, Some(ImageRef { id }));
}

fn draw_shape(
    content: &mut Content,
    deck: &Deck,
    shape: &Shape,
    images: &HashMap<u32, Option<ImageRef>>,
) {
    if shape.width < 0.0
        || shape.height < 0.0
        || (shape.geometry != Geometry::Line && (shape.width <= 0.0 || shape.height <= 0.0))
    {
        return;
    }

    content.save_state();
    apply_rotation(content, shape, deck.height);

    if shape.geometry != Geometry::Line {
        if let Some(fill) = shape.fill {
            set_fill(content, fill);
            build_path(content, shape, deck.height);
            content.fill_nonzero();
        }

        if let Some(line) = shape.line {
            draw_path_stroke(content, shape, line, deck.height);
        }
    } else if let Some(line) = shape.line {
        draw_line(content, shape, line, deck.height);
    }

    if let Some(index) = shape.image {
        draw_image(content, shape, index, deck.height, images);
    }

    if let Some(table) = shape
        .table
        .and_then(|index| deck.tables.get(index as usize))
    {
        draw_table(content, deck, shape, table);
    }

    if let Some(text) = shape.text {
        draw_text_box(
            content,
            deck,
            text,
            shape.x,
            shape.y,
            shape.width,
            shape.height,
        );
    }

    content.restore_state();
}

fn apply_rotation(content: &mut Content, shape: &Shape, page_height: f32) {
    if shape.rotation.abs() < 0.01 {
        return;
    }

    let angle = -shape.rotation * PI / 180.0;
    let (sin, cos) = angle.sin_cos();
    let cx = shape.x + shape.width / 2.0;
    let cy = page_height - (shape.y + shape.height / 2.0);
    let e = cx - cos * cx + sin * cy;
    let f = cy - sin * cx - cos * cy;

    content.transform([cos, sin, -sin, cos, e, f]);
}

fn set_fill(content: &mut Content, color: Color) {
    let [r, g, b] = color.components();

    apply_alpha(content, color.a);
    content.set_fill_rgb(r, g, b);
}

fn set_stroke(content: &mut Content, color: Color) {
    let [r, g, b] = color.components();

    apply_alpha(content, color.a);
    content.set_stroke_rgb(r, g, b);
}

fn build_path(content: &mut Content, shape: &Shape, page_height: f32) {
    let x = shape.x;
    let top = page_height - shape.y;
    let width = shape.width;
    let height = shape.height;
    let bottom = top - height;

    match shape.geometry {
        Geometry::Rect => {
            content.rect(x, bottom, width, height);
        }
        Geometry::RoundRect => {
            let radius = (width.min(height) * 0.12).clamp(0.5, 20.0);
            let k = 0.552_284_8;

            content.move_to(x + radius, top);
            content.line_to(x + width - radius, top);
            content.cubic_to(
                x + width - radius + k * radius,
                top,
                x + width,
                top - radius + k * radius,
                x + width,
                top - radius,
            );
            content.line_to(x + width, bottom + radius);
            content.cubic_to(
                x + width,
                bottom + radius - k * radius,
                x + width - radius + k * radius,
                bottom,
                x + width - radius,
                bottom,
            );
            content.line_to(x + radius, bottom);
            content.cubic_to(
                x + radius - k * radius,
                bottom,
                x,
                bottom + radius - k * radius,
                x,
                bottom + radius,
            );
            content.line_to(x, top - radius);
            content.cubic_to(
                x,
                top - radius + k * radius,
                x + radius - k * radius,
                top,
                x + radius,
                top,
            );
            content.close_path();
        }
        Geometry::Ellipse => {
            let cx = x + width / 2.0;
            let cy = bottom + height / 2.0;
            let rx = width / 2.0;
            let ry = height / 2.0;
            let k = 0.552_284_8;

            content.move_to(cx, cy + ry);
            content.cubic_to(cx + k * rx, cy + ry, cx + rx, cy + k * ry, cx + rx, cy);
            content.cubic_to(cx + rx, cy - k * ry, cx + k * rx, cy - ry, cx, cy - ry);
            content.cubic_to(cx - k * rx, cy - ry, cx - rx, cy - k * ry, cx - rx, cy);
            content.cubic_to(cx - rx, cy + k * ry, cx - k * rx, cy + ry, cx, cy + ry);
            content.close_path();
        }
        Geometry::Triangle => {
            polygon(
                content,
                &[(x + width / 2.0, top), (x + width, bottom), (x, bottom)],
            );
        }
        Geometry::Diamond => {
            polygon(
                content,
                &[
                    (x + width / 2.0, top),
                    (x + width, bottom + height / 2.0),
                    (x + width / 2.0, bottom),
                    (x, bottom + height / 2.0),
                ],
            );
        }
        Geometry::Parallelogram => {
            let inset = width * 0.2;

            polygon(
                content,
                &[
                    (x + inset, top),
                    (x + width, top),
                    (x + width - inset, bottom),
                    (x, bottom),
                ],
            );
        }
        Geometry::Trapezoid => {
            let inset = width * 0.15;

            polygon(
                content,
                &[
                    (x + inset, top),
                    (x + width - inset, top),
                    (x + width, bottom),
                    (x, bottom),
                ],
            );
        }
        Geometry::Hexagon => {
            let inset = width * 0.2;

            polygon(
                content,
                &[
                    (x + inset, top),
                    (x + width - inset, top),
                    (x + width, bottom + height / 2.0),
                    (x + width - inset, bottom),
                    (x + inset, bottom),
                    (x, bottom + height / 2.0),
                ],
            );
        }
        Geometry::Chevron => {
            let inset = width * 0.2;

            polygon(
                content,
                &[
                    (x, top),
                    (x + width - inset, top),
                    (x + width, bottom + height / 2.0),
                    (x + width - inset, bottom),
                    (x, bottom),
                    (x + inset, bottom + height / 2.0),
                ],
            );
        }
        Geometry::RightArrow | Geometry::LeftArrow => {
            let shaft = height * 0.4;
            let head = width * 0.35;
            let mid = bottom + height / 2.0;

            if shape.geometry == Geometry::RightArrow {
                polygon(
                    content,
                    &[
                        (x, mid + shaft / 2.0),
                        (x + width - head, mid + shaft / 2.0),
                        (x + width - head, top),
                        (x + width, mid),
                        (x + width - head, bottom),
                        (x + width - head, mid - shaft / 2.0),
                        (x, mid - shaft / 2.0),
                    ],
                );
            } else {
                polygon(
                    content,
                    &[
                        (x + head, mid + shaft / 2.0),
                        (x + width, mid + shaft / 2.0),
                        (x + width, mid - shaft / 2.0),
                        (x + head, mid - shaft / 2.0),
                        (x + head, bottom),
                        (x, mid),
                        (x + head, top),
                    ],
                );
            }
        }
        Geometry::UpArrow | Geometry::DownArrow => {
            let shaft = width * 0.4;
            let head = height * 0.35;
            let mid = x + width / 2.0;

            if shape.geometry == Geometry::UpArrow {
                polygon(
                    content,
                    &[
                        (mid - shaft / 2.0, bottom),
                        (mid - shaft / 2.0, top - head),
                        (x, top - head),
                        (mid, top),
                        (x + width, top - head),
                        (mid + shaft / 2.0, top - head),
                        (mid + shaft / 2.0, bottom),
                    ],
                );
            } else {
                polygon(
                    content,
                    &[
                        (mid - shaft / 2.0, top),
                        (mid - shaft / 2.0, bottom + head),
                        (x, bottom + head),
                        (mid, bottom),
                        (x + width, bottom + head),
                        (mid + shaft / 2.0, bottom + head),
                        (mid + shaft / 2.0, top),
                    ],
                );
            }
        }
        Geometry::Star => {
            let cx = x + width / 2.0;
            let cy = bottom + height / 2.0;
            let mut points = Vec::with_capacity(10);

            for index in 0..10 {
                let angle = -PI / 2.0 + index as f32 * PI / 5.0;
                let scale = if index % 2 == 0 { 0.5 } else { 0.21 };

                points.push((
                    cx + angle.cos() * width * scale,
                    cy - angle.sin() * height * scale,
                ));
            }

            polygon(content, &points);
        }
        Geometry::Line => {}
    }
}

fn polygon(content: &mut Content, points: &[(f32, f32)]) {
    let Some((first, rest)) = points.split_first() else {
        return;
    };

    content.move_to(first.0, first.1);

    for point in rest {
        content.line_to(point.0, point.1);
    }

    content.close_path();
}

fn draw_path_stroke(content: &mut Content, shape: &Shape, line: LineStyle, page_height: f32) {
    set_stroke(content, line.color);
    content.set_line_width(line.width);

    if let Some(dash) = line.dash {
        content.set_dash_pattern(dash.iter().copied(), 0.0);
    }

    build_path(content, shape, page_height);
    content.stroke();
}

fn draw_line(content: &mut Content, shape: &Shape, line: LineStyle, page_height: f32) {
    set_stroke(content, line.color);
    content.set_line_width(line.width);

    if let Some(dash) = line.dash {
        content.set_dash_pattern(dash.iter().copied(), 0.0);
    }

    let x1 = shape.x;
    let y1 = page_height - shape.y;
    let x2 = shape.x + shape.width;
    let y2 = page_height - shape.y - shape.height;

    content.move_to(x1, y1);
    content.line_to(x2, y2);
    content.stroke();

    if line.arrow_tail {
        draw_arrowhead(content, x1, y1, x2, y2, line.width);
    }

    if line.arrow_head {
        draw_arrowhead(content, x2, y2, x1, y1, line.width);
    }
}

fn draw_arrowhead(
    content: &mut Content,
    tip_x: f32,
    tip_y: f32,
    from_x: f32,
    from_y: f32,
    width: f32,
) {
    let angle = (tip_y - from_y).atan2(tip_x - from_x);
    let length = (width * 4.0).max(4.0);
    let spread = PI / 7.0;

    content.move_to(tip_x, tip_y);
    content.line_to(
        tip_x - length * (angle - spread).cos(),
        tip_y - length * (angle - spread).sin(),
    );
    content.move_to(tip_x, tip_y);
    content.line_to(
        tip_x - length * (angle + spread).cos(),
        tip_y - length * (angle + spread).sin(),
    );
    content.stroke();
}

fn draw_image(
    content: &mut Content,
    shape: &Shape,
    index: u32,
    page_height: f32,
    images: &HashMap<u32, Option<ImageRef>>,
) {
    let Some(Some(_)) = images.get(&index) else {
        return;
    };
    let [left, top, right, bottom] = shape.image_crop.unwrap_or([0.0; 4]);
    let visible_width = (1.0 - left - right).max(0.05);
    let visible_height = (1.0 - top - bottom).max(0.05);
    let draw_width = shape.width / visible_width;
    let draw_height = shape.height / visible_height;
    let draw_x = shape.x - left * draw_width;
    let draw_y = shape.y - top * draw_height;
    let clip_y = page_height - shape.y - shape.height;
    let name = format!("Im{index}");

    content.save_state();
    content.rect(shape.x, clip_y, shape.width, shape.height);
    content.clip_nonzero();
    content.end_path();
    content.transform([
        draw_width,
        0.0,
        0.0,
        draw_height,
        draw_x,
        page_height - draw_y - draw_height,
    ]);
    content.x_object(Name(name.as_bytes()));
    content.restore_state();
}

fn draw_table(content: &mut Content, deck: &Deck, shape: &Shape, table: &Table) {
    let x_offsets = offsets(&table.column_widths, shape.x);
    let y_offsets = offsets(&table.row_heights, shape.y);
    let cells =
        &deck.cells[table.cell_start as usize..(table.cell_start + table.cell_count) as usize];

    for cell in cells {
        let (Some(&x), Some(&y)) = (
            x_offsets.get(cell.column as usize),
            y_offsets.get(cell.row as usize),
        ) else {
            continue;
        };
        let Some(column_end) = table
            .column_widths
            .get(cell.column as usize..(cell.column + cell.column_span) as usize)
        else {
            continue;
        };
        let Some(row_end) = table
            .row_heights
            .get(cell.row as usize..(cell.row + cell.row_span) as usize)
        else {
            continue;
        };
        let width = column_end.iter().sum::<f32>();
        let height = row_end.iter().sum::<f32>();

        if let Some(fill) = cell.fill {
            set_fill(content, fill);
            content.rect(x, deck.height - y - height, width, height);
            content.fill_nonzero();
        }

        draw_cell_borders(content, deck, cell, x, y, width, height);

        if let Some(text) = cell.text {
            draw_text_box(content, deck, text, x, y, width, height);
        }
    }
}

fn draw_cell_borders(
    content: &mut Content,
    deck: &Deck,
    cell: &Cell,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
) {
    let top = deck.height - y;
    let bottom = top - height;

    for (index, border) in cell.borders.iter().enumerate() {
        let Some(border) = border else {
            continue;
        };

        set_stroke(content, border.color);
        content.set_line_width(border.width);

        match index {
            0 => {
                content.move_to(x, top);
                content.line_to(x, bottom);
            }
            1 => {
                content.move_to(x + width, top);
                content.line_to(x + width, bottom);
            }
            2 => {
                content.move_to(x, top);
                content.line_to(x + width, top);
            }
            _ => {
                content.move_to(x, bottom);
                content.line_to(x + width, bottom);
            }
        }

        content.stroke();
    }
}

fn offsets(values: &[f32], start: f32) -> Vec<f32> {
    let mut offsets = Vec::with_capacity(values.len() + 1);
    let mut current = start;

    for value in values {
        offsets.push(current);
        current += value;
    }

    offsets.push(current);

    offsets
}

fn draw_text_box(
    content: &mut Content,
    deck: &Deck,
    text: TextBox,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
) {
    let content_x = x + text.insets.left;
    let content_y = y + text.insets.top;
    let content_width = (width - text.insets.left - text.insets.right).max(1.0);
    let content_height = (height - text.insets.top - text.insets.bottom).max(1.0);
    let layout_width = if text.wrap {
        content_width
    } else {
        1_000_000.0
    };
    let lines = layout_text(deck, text, layout_width);
    let total_height: f32 = lines
        .iter()
        .map(|line| line.space_before + line.size * 1.2 * line.line_spacing + line.space_after)
        .sum();
    let start_y = match text.anchor {
        Anchor::Top => content_y,
        Anchor::Middle => content_y + (content_height - total_height).max(0.0) / 2.0,
        Anchor::Bottom => content_y + (content_height - total_height).max(0.0),
    };
    let mut current_y = start_y;
    let mut auto_numbers = [0u32; 9];

    for line in lines {
        current_y += line.space_before;

        let line_height = line.size * 1.2 * line.line_spacing;
        let baseline = current_y + line.size * 0.8;
        let pdf_baseline = deck.height - baseline;
        let mut text_x = content_x + line.margin_left;

        if let Some(bullet) = line.bullet {
            let bullet_text = if bullet.auto {
                auto_numbers[line.level as usize] += 1;
                format!("{}.", auto_numbers[line.level as usize])
            } else {
                bullet.character.to_string()
            };
            let bullet_size = line.size * 0.9;

            draw_text_run(
                content,
                &bullet_text,
                content_x + line.margin_left + line.indent,
                pdf_baseline,
                bullet_size,
                false,
                false,
                false,
                Color::BLACK,
                FontFamily::Sans,
            );
            text_x += measure(&bullet_text, line.size, FontFamily::Sans, false) + 5.0;
        }

        let available = (content_width - line.margin_left).max(1.0);
        let alignment_offset = match line.align {
            Align::Left => 0.0,
            Align::Center => (available - line.width).max(0.0) / 2.0,
            Align::Right => (available - line.width).max(0.0),
        };

        text_x += alignment_offset;

        for segment in line.segments {
            let text = &deck.text[segment.start as usize..(segment.start + segment.len) as usize];

            draw_text_run(
                content,
                text,
                text_x,
                pdf_baseline,
                segment.style.size,
                segment.style.bold,
                segment.style.italic,
                segment.style.underline,
                segment.style.color,
                segment.style.font,
            );
            text_x += segment.width;
        }

        current_y += line_height + line.space_after;
    }
}

fn layout_text(deck: &Deck, text: TextBox, content_width: f32) -> Vec<Line> {
    let mut lines = Vec::new();
    let paragraphs = &deck.paragraphs
        [text.paragraph_start as usize..(text.paragraph_start + text.paragraph_count) as usize];

    for paragraph in paragraphs {
        let runs = deck.paragraph_runs(paragraph);
        let mut tokens = Vec::new();

        for run in runs {
            tokenize(
                deck.run_text(run),
                run.text_start,
                run.size,
                run.bold,
                run.italic,
                run.underline,
                run.color,
                run.font,
                &mut tokens,
            );
        }

        if tokens.is_empty() {
            lines.push(Line {
                segments: Vec::new(),
                width: 0.0,
                size: paragraph.base_size,
                bullet: paragraph.bullet,
                level: paragraph.level,
                margin_left: paragraph.margin_left,
                indent: paragraph.indent,
                space_before: paragraph.space_before,
                space_after: paragraph.space_after,
                line_spacing: paragraph.line_spacing,
                align: paragraph.align,
            });

            continue;
        }

        let mut current = Line {
            segments: Vec::new(),
            width: 0.0,
            size: paragraph.base_size,
            bullet: paragraph.bullet,
            level: paragraph.level,
            margin_left: paragraph.margin_left,
            indent: paragraph.indent,
            space_before: paragraph.space_before,
            space_after: 0.0,
            line_spacing: paragraph.line_spacing,
            align: paragraph.align,
        };
        let mut first = true;

        for token in tokens {
            if token.break_line {
                push_line(&mut lines, &mut current);

                continue;
            }

            if token.width > 0.0
                && current.width + token.width > content_width
                && !current.segments.is_empty()
            {
                push_line(&mut lines, &mut current);
            }

            if token.whitespace && current.segments.is_empty() {
                continue;
            }

            current.width += token.width;
            current.size = current.size.max(token.style.size);
            current.segments.push(Segment {
                start: token.start,
                len: token.len,
                width: token.width,
                style: token.style,
            });
            first = false;
        }

        if !current.segments.is_empty() || first {
            current.space_after = paragraph.space_after;
            lines.push(current);
        } else if let Some(last) = lines.last_mut() {
            last.space_after = paragraph.space_after;
        }
    }

    lines
}

fn push_line(lines: &mut Vec<Line>, current: &mut Line) {
    let next = Line {
        segments: Vec::new(),
        width: 0.0,
        size: current.size,
        bullet: current.bullet,
        level: current.level,
        margin_left: current.margin_left,
        indent: 0.0,
        space_before: 0.0,
        space_after: 0.0,
        line_spacing: current.line_spacing,
        align: current.align,
    };

    lines.push(std::mem::replace(current, next));
    current.bullet = None;
}

struct Token {
    start: u32,
    len: u32,
    width: f32,
    style: TextStyle,
    whitespace: bool,
    break_line: bool,
}

#[allow(clippy::too_many_arguments)]
fn tokenize(
    text: &str,
    base: u32,
    size: f32,
    bold: bool,
    italic: bool,
    underline: bool,
    color: Color,
    font: FontFamily,
    tokens: &mut Vec<Token>,
) {
    let style = TextStyle {
        size,
        bold,
        italic,
        underline,
        color,
        font,
    };
    let mut word_start: Option<usize> = None;
    let mut word_width = 0.0f32;

    let flush_word = |tokens: &mut Vec<Token>,
                      word_start: &mut Option<usize>,
                      word_width: &mut f32,
                      end: usize| {
        if let Some(start) = word_start.take() {
            tokens.push(Token {
                start: base + start as u32,
                len: (end - start) as u32,
                width: *word_width,
                style: style.clone(),
                whitespace: false,
                break_line: false,
            });
            *word_width = 0.0;
        }
    };

    for (index, character) in text.char_indices() {
        if character == '\n' {
            flush_word(tokens, &mut word_start, &mut word_width, index);
            tokens.push(Token {
                start: base + index as u32,
                len: 1,
                width: 0.0,
                style: style.clone(),
                whitespace: false,
                break_line: true,
            });

            continue;
        }

        let width = measure_char(character, size, font, bold);

        if character.is_whitespace() || is_cjk(character) {
            flush_word(tokens, &mut word_start, &mut word_width, index);
            tokens.push(Token {
                start: base + index as u32,
                len: character.len_utf8() as u32,
                width: if character.is_whitespace() {
                    width
                } else {
                    width
                },
                style: style.clone(),
                whitespace: character.is_whitespace(),
                break_line: false,
            });
        } else {
            if word_start.is_none() {
                word_start = Some(index);
            }

            word_width += width;
        }
    }

    flush_word(tokens, &mut word_start, &mut word_width, text.len());
}

fn draw_text_run(
    content: &mut Content,
    text: &str,
    x: f32,
    baseline: f32,
    size: f32,
    bold: bool,
    italic: bool,
    underline: bool,
    color: Color,
    font: FontFamily,
) {
    if text.is_empty() {
        return;
    }

    let font_name = font_for(font, bold, italic);
    let bytes = winansi(text);

    content.begin_text();
    content.set_font(Name(font_name), size);
    set_fill(content, color);
    content.set_text_matrix([1.0, 0.0, 0.0, 1.0, x, baseline]);
    content.show(Str(&bytes));
    content.end_text();

    if underline {
        set_stroke(content, color);
        content.set_line_width((size * 0.06).max(0.4));
        content.move_to(x, baseline - size * 0.1);
        content.line_to(x + measure(text, size, font, bold), baseline - size * 0.1);
        content.stroke();
    }
}

fn font_for(font: FontFamily, bold: bool, italic: bool) -> &'static [u8] {
    let base = match font {
        FontFamily::Sans => 0,
        FontFamily::Serif => 4,
        FontFamily::Mono => 8,
    };
    let index = base
        + match (bold, italic) {
            (false, false) => 0,
            (true, false) => 1,
            (false, true) => 2,
            (true, true) => 3,
        };

    FONT_NAMES[index]
}

fn measure(text: &str, size: f32, font: FontFamily, bold: bool) -> f32 {
    text.chars()
        .map(|character| measure_char(character, size, font, bold))
        .sum()
}

fn measure_char(character: char, size: f32, font: FontFamily, bold: bool) -> f32 {
    let units = if (32..=126).contains(&(character as u32)) {
        let index = (character as usize) - 32;

        f32::from(if bold {
            HELVETICA_BOLD_WIDTHS[index]
        } else {
            HELVETICA_WIDTHS[index]
        })
    } else if is_cjk(character) {
        1000.0
    } else {
        550.0
    };
    let factor = match font {
        FontFamily::Sans => 1.0,
        FontFamily::Serif => 0.95,
        FontFamily::Mono => 0.6,
    };

    units * factor * size / 1000.0
}

fn is_cjk(character: char) -> bool {
    matches!(
        character as u32,
        0x2E80..=0x9FFF | 0xAC00..=0xD7AF | 0xF900..=0xFAFF | 0x20000..=0x2FA1F
    )
}

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
