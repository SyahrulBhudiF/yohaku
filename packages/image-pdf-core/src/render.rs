use std::io::Write;

use flate2::write::ZlibEncoder;
use flate2::Compression;
use pdf_writer::{Content, Filter, Finish, Name, Pdf, Rect, Ref};

use crate::decode::{decode, DecodedImage};
use crate::layout::layout_pages;

fn compress(data: &[u8]) -> Vec<u8> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());

    encoder.write_all(data).expect("compress");
    encoder.finish().expect("finish compression")
}

fn decode_images(
    data: &[u8],
    lengths: &[u32],
    formats: &[u8],
) -> Result<Vec<DecodedImage>, String> {
    if lengths.len() != formats.len() || lengths.is_empty() {
        return Err("image metadata is incomplete".into());
    }

    let mut images = Vec::with_capacity(lengths.len());
    let mut offset = 0usize;

    for (index, length) in lengths.iter().enumerate() {
        let length = *length as usize;
        let end = offset.checked_add(length).ok_or("image offset overflow")?;

        if end > data.len() {
            return Err("image data is truncated".into());
        }

        images.push(decode(&data[offset..end], formats[index])?);
        offset = end;
    }

    if offset != data.len() {
        return Err("image data has trailing bytes".into());
    }

    Ok(images)
}

/// Builds an image-only PDF from a concatenated PNG/JPEG buffer.
///
/// `lengths` and `formats` are parallel arrays; format 0 is PNG, 1 is JPEG.
/// `page_size` is either `fit` or `a4`.
pub fn build_pdf(
    data: &[u8],
    lengths: &[u32],
    formats: &[u8],
    page_size: &str,
) -> Result<Vec<u8>, String> {
    let images = decode_images(data, lengths, formats)?;
    let dimensions: Vec<(u32, u32)> = images
        .iter()
        .map(|image| (image.width, image.height))
        .collect();
    let layouts = layout_pages(&dimensions, page_size);
    let mut pdf = Pdf::new();
    let catalog_id = Ref::new(1);
    let pages_id = Ref::new(2);
    let mut next_id = 3i32;
    let mut page_ids = Vec::with_capacity(images.len());
    let image_name = Name(b"Im1");

    for (index, image) in images.iter().enumerate() {
        let page_id = Ref::new(next_id);
        let content_id = Ref::new(next_id + 1);
        let image_id = Ref::new(next_id + 2);
        next_id += 3;

        let smask_id = if image.alpha.is_some() {
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

        let (filter, encoded) = match &image.jpeg {
            Some(jpeg) => (Filter::DctDecode, jpeg.clone()),
            None => (Filter::FlateDecode, compress(&image.rgb)),
        };
        let mut xobject = pdf.image_xobject(image_id, &encoded);

        xobject.filter(filter);
        xobject.width(image.width as i32);
        xobject.height(image.height as i32);
        xobject.color_space().device_rgb();
        xobject.bits_per_component(8);

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
}
