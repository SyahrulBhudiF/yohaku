use std::io::Write;

use flate2::write::ZlibEncoder;
use flate2::Compression;
use pdf_writer::{Content, Filter, Finish, Name, Pdf, Rect, Ref};

use crate::decode::{decode, dimensions, DecodedImage};
use crate::layout::layout_pages;

fn compress(data: &[u8]) -> Vec<u8> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());

    encoder.write_all(data).expect("compress");
    encoder.finish().expect("finish compression")
}

fn image_slices<'a>(
    data: &'a [u8],
    lengths: &[u32],
    formats: &[u8],
) -> Result<Vec<&'a [u8]>, String> {
    if lengths.len() != formats.len() || lengths.is_empty() {
        return Err("image metadata is incomplete".into());
    }

    let mut slices = Vec::with_capacity(lengths.len());
    let mut offset = 0usize;

    for length in lengths {
        let end = offset
            .checked_add(*length as usize)
            .ok_or("image offset overflow")?;

        if end > data.len() {
            return Err("image data is truncated".into());
        }

        slices.push(&data[offset..end]);
        offset = end;
    }

    if offset != data.len() {
        return Err("image data has trailing bytes".into());
    }

    Ok(slices)
}

/// Builds an image-only PDF from a concatenated PNG/JPEG buffer.
///
/// `lengths` and `formats` are parallel arrays; format 0 is PNG, 1 is JPEG.
/// `page_size` is either `fit` or `a4`. Images are decoded one at a time so
/// peak memory stays proportional to the largest page instead of every page.
pub fn build_pdf(
    data: &[u8],
    lengths: &[u32],
    formats: &[u8],
    page_size: &str,
) -> Result<Vec<u8>, String> {
    let slices = image_slices(data, lengths, formats)?;
    let page_dimensions: Vec<(u32, u32)> = slices
        .iter()
        .zip(formats)
        .map(|(bytes, format)| dimensions(bytes, *format))
        .collect::<Result<_, _>>()?;
    let layouts = layout_pages(&page_dimensions, page_size);
    let mut pdf = Pdf::new();
    let catalog_id = Ref::new(1);
    let pages_id = Ref::new(2);
    let mut next_id = 3i32;
    let mut page_ids = Vec::with_capacity(slices.len());
    let image_name = Name(b"Im1");

    for (index, bytes) in slices.iter().enumerate() {
        let DecodedImage {
            width,
            height,
            rgb,
            alpha,
            jpeg,
        } = decode(bytes, formats[index])?;
        let page_id = Ref::new(next_id);
        let content_id = Ref::new(next_id + 1);
        let image_id = Ref::new(next_id + 2);
        next_id += 3;

        let smask_id = if alpha.is_some() {
            let id = Ref::new(next_id);
            next_id += 1;

            Some(id)
        } else {
            None
        };

        let page_width = layouts.page_width()[index];
        let page_height = layouts.page_height()[index];
        let draw_width = layouts.draw_width()[index];
        let draw_height = layouts.draw_height()[index];
        let x = layouts.x()[index];
        let y = layouts.y()[index];

        let mut page = pdf.page(page_id);

        page.parent(pages_id)
            .media_box(Rect::new(0.0, 0.0, page_width, page_height))
            .contents(content_id);
        page.resources().x_objects().pair(image_name, image_id);
        page.finish();

        let mut content = Content::new();

        content.save_state();
        content.transform([draw_width, 0.0, 0.0, draw_height, x, y]);
        content.x_object(image_name);
        content.restore_state();
        pdf.stream(content_id, &content.finish());

        let (filter, encoded) = match jpeg {
            Some(jpeg) => (Filter::DctDecode, jpeg),
            None => (Filter::FlateDecode, compress(&rgb)),
        };
        let mut xobject = pdf.image_xobject(image_id, &encoded);

        xobject.filter(filter);
        xobject.width(width as i32);
        xobject.height(height as i32);
        xobject.color_space().device_rgb();
        xobject.bits_per_component(8);

        if let Some(smask_id) = smask_id {
            xobject.s_mask(smask_id);
        }

        xobject.finish();

        if let (Some(smask_id), Some(alpha)) = (smask_id, &alpha) {
            let encoded = compress(alpha);
            let mut mask = pdf.image_xobject(smask_id, &encoded);

            mask.filter(Filter::FlateDecode);
            mask.width(width as i32);
            mask.height(height as i32);
            mask.color_space().device_gray();
            mask.bits_per_component(8);
            mask.finish();
        }

        page_ids.push(page_id);
    }

    pdf.catalog(catalog_id).pages(pages_id);
    pdf.pages(pages_id)
        .kids(page_ids.iter().copied())
        .count(page_ids.len() as i32);

    Ok(pdf.finish())
}

#[cfg(test)]
mod tests {
    use png::{BitDepth, ColorType, Encoder};

    use super::build_pdf;

    fn png(width: u32, height: u32, alpha: bool) -> Vec<u8> {
        let mut output = Vec::new();
        let mut encoder = Encoder::new(&mut output, width, height);

        encoder.set_color(if alpha {
            ColorType::Rgba
        } else {
            ColorType::Rgb
        });
        encoder.set_depth(BitDepth::Eight);

        let mut writer = encoder.write_header().expect("png header");
        let channels = if alpha { 4 } else { 3 };
        let mut data = Vec::with_capacity((width * height * channels) as usize);

        for _ in 0..width * height {
            data.extend_from_slice(if alpha {
                &[20, 40, 60, 128]
            } else {
                &[20, 40, 60]
            });
        }

        writer.write_image_data(&data).expect("png data");
        drop(writer);

        output
    }

    #[test]
    fn builds_a_pdf_with_one_page_per_image() {
        let first = png(8, 6, false);
        let second = png(6, 8, true);
        let mut data = first.clone();

        data.extend_from_slice(&second);

        let pdf = build_pdf(
            &data,
            &[first.len() as u32, second.len() as u32],
            &[0, 0],
            "fit",
        )
        .expect("pdf");

        assert!(pdf.starts_with(b"%PDF"));
        assert!(pdf.len() > 100);
    }

    #[test]
    fn rejects_incomplete_metadata() {
        assert!(build_pdf(&[], &[], &[], "fit").is_err());
    }

    #[test]
    fn rejects_images_above_the_pixel_limit() {
        let oversized = png(5_000, 5_000, false);

        assert!(build_pdf(&oversized, &[oversized.len() as u32], &[0], "fit").is_err());
    }
}
