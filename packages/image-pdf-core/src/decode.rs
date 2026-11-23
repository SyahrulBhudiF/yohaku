use std::io::Cursor;

use jpeg_decoder::Decoder as JpegDecoder;
use png::{ColorType, Decoder, Transformations};

pub(crate) struct DecodedImage {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgb: Vec<u8>,
    pub(crate) alpha: Option<Vec<u8>>,
    pub(crate) jpeg: Option<Vec<u8>>,
}

pub(crate) fn decode(bytes: &[u8], format: u8) -> Result<DecodedImage, String> {
    match format {
        0 => decode_png(bytes),
        1 => decode_jpeg(bytes),
        _ => Err("unsupported image format".into()),
    }
}

fn decode_png(bytes: &[u8]) -> Result<DecodedImage, String> {
    let mut decoder = Decoder::new(Cursor::new(bytes));
    decoder.set_transformations(Transformations::EXPAND | Transformations::STRIP_16);

    let mut reader = decoder.read_info().map_err(|error| error.to_string())?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader
        .next_frame(&mut buffer)
        .map_err(|error| error.to_string())?;
    let data = &buffer[..info.buffer_size()];
    let width = info.width;
    let height = info.height;
    let mut rgb = Vec::with_capacity((width * height * 3) as usize);
    let alpha = match info.color_type {
        ColorType::Rgb => {
            rgb.extend_from_slice(data);
            None
        }
        ColorType::Rgba => {
            let mut alpha = Vec::with_capacity((width * height) as usize);

            for pixel in data.chunks_exact(4) {
                rgb.extend_from_slice(&pixel[..3]);
                alpha.push(pixel[3]);
            }

            Some(alpha)
        }
        ColorType::Grayscale => {
            for value in data {
                rgb.extend_from_slice(&[*value, *value, *value]);
            }

            None
        }
        ColorType::GrayscaleAlpha => {
            let mut alpha = Vec::with_capacity((width * height) as usize);

            for pixel in data.chunks_exact(2) {
                rgb.extend_from_slice(&[pixel[0], pixel[0], pixel[0]]);
                alpha.push(pixel[1]);
            }

            Some(alpha)
        }
        ColorType::Indexed => return Err("indexed PNG was not expanded".into()),
    };

    Ok(DecodedImage {
        width,
        height,
        rgb,
        alpha,
        jpeg: None,
    })
}

fn decode_jpeg(bytes: &[u8]) -> Result<DecodedImage, String> {
    let mut decoder = JpegDecoder::new(Cursor::new(bytes));
    decoder.read_info().map_err(|error| error.to_string())?;
    let info = decoder.info().ok_or("JPEG has no image info")?;

    Ok(DecodedImage {
        width: info.width as u32,
        height: info.height as u32,
        rgb: Vec::new(),
        alpha: None,
        jpeg: Some(bytes.to_vec()),
    })
}
