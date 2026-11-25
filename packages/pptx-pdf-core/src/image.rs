use std::io::Cursor;

use jpeg_decoder::{Decoder as JpegDecoder, PixelFormat};
use png::{ColorType, Decoder, Transformations};

use crate::error::{ConvertError, Result};
use crate::limits::MAX_IMAGE_PIXELS;
use crate::model::ImageFormat;

pub struct DecodedImage {
    pub width: u32,
    pub height: u32,
    pub rgb: Vec<u8>,
    pub alpha: Option<Vec<u8>>,
    pub jpeg: Option<Vec<u8>>,
    pub gray: bool,
}

pub fn dimensions(bytes: &[u8], format: ImageFormat) -> Result<(u32, u32)> {
    let (width, height) = match format {
        ImageFormat::Png => {
            let decoder = Decoder::new(Cursor::new(bytes));
            let reader = decoder
                .read_info()
                .map_err(|_| ConvertError::InvalidPresentation)?;

            (reader.info().width, reader.info().height)
        }
        ImageFormat::Jpeg => {
            let mut decoder = JpegDecoder::new(Cursor::new(bytes));
            decoder
                .read_info()
                .map_err(|_| ConvertError::InvalidPresentation)?;
            let info = decoder.info().ok_or(ConvertError::InvalidPresentation)?;

            (u32::from(info.width), u32::from(info.height))
        }
    };

    check_dimensions(width, height)?;

    Ok((width, height))
}

pub fn decode(bytes: &[u8], format: ImageFormat) -> Result<DecodedImage> {
    match format {
        ImageFormat::Png => decode_png(bytes),
        ImageFormat::Jpeg => decode_jpeg(bytes),
    }
}

fn check_dimensions(width: u32, height: u32) -> Result<()> {
    if width == 0 || height == 0 {
        return Err(ConvertError::InvalidPresentation);
    }

    if u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err(ConvertError::ImageTooLarge);
    }

    Ok(())
}

fn decode_png(bytes: &[u8]) -> Result<DecodedImage> {
    let mut decoder = Decoder::new(Cursor::new(bytes));
    decoder.set_transformations(Transformations::EXPAND | Transformations::STRIP_16);

    let mut reader = decoder
        .read_info()
        .map_err(|_| ConvertError::InvalidPresentation)?;
    let width = reader.info().width;
    let height = reader.info().height;

    check_dimensions(width, height)?;

    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader
        .next_frame(&mut buffer)
        .map_err(|_| ConvertError::InvalidPresentation)?;
    let data = &buffer[..info.buffer_size()];
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
        ColorType::Indexed => return Err(ConvertError::InvalidPresentation),
    };

    Ok(DecodedImage {
        width,
        height,
        rgb,
        alpha,
        jpeg: None,
        gray: false,
    })
}

fn decode_jpeg(bytes: &[u8]) -> Result<DecodedImage> {
    let mut decoder = JpegDecoder::new(Cursor::new(bytes));
    decoder
        .read_info()
        .map_err(|_| ConvertError::InvalidPresentation)?;
    let info = decoder.info().ok_or(ConvertError::InvalidPresentation)?;
    let width = u32::from(info.width);
    let height = u32::from(info.height);

    check_dimensions(width, height)?;

    let data = decoder
        .decode()
        .map_err(|_| ConvertError::InvalidPresentation)?;
    let pixel_format = decoder
        .info()
        .ok_or(ConvertError::InvalidPresentation)?
        .pixel_format;

    match pixel_format {
        PixelFormat::L8 => Ok(DecodedImage {
            width,
            height,
            rgb: data,
            alpha: None,
            jpeg: Some(bytes.to_vec()),
            gray: true,
        }),
        PixelFormat::RGB24 => Ok(DecodedImage {
            width,
            height,
            rgb: data,
            alpha: None,
            jpeg: Some(bytes.to_vec()),
            gray: false,
        }),
        PixelFormat::CMYK32 => {
            let mut rgb = Vec::with_capacity((width * height * 3) as usize);

            for pixel in data.chunks_exact(4) {
                let c = f32::from(pixel[0]) / 255.0;
                let m = f32::from(pixel[1]) / 255.0;
                let y = f32::from(pixel[2]) / 255.0;
                let k = f32::from(pixel[3]) / 255.0;

                rgb.push(((1.0 - c) * (1.0 - k) * 255.0).round() as u8);
                rgb.push(((1.0 - m) * (1.0 - k) * 255.0).round() as u8);
                rgb.push(((1.0 - y) * (1.0 - k) * 255.0).round() as u8);
            }

            Ok(DecodedImage {
                width,
                height,
                rgb,
                alpha: None,
                jpeg: None,
                gray: false,
            })
        }
        _ => Err(ConvertError::InvalidPresentation),
    }
}
