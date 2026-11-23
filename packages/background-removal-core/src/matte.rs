use crate::color::{background_noise, sample_background, squared_distance, Rgb, RANGE};

fn seed(
    data: &[u8],
    mask: &mut [u8],
    stack: &mut Vec<u32>,
    width: usize,
    x: usize,
    y: usize,
    background: Rgb,
    high_squared: u32,
) {
    let index = y * width + x;

    if mask[index] == 0 && squared_distance(data, index * 4, background) <= high_squared {
        mask[index] = 1;
        stack.push(index as u32);
    }
}

fn feather(mask: &[u8], width: usize, height: usize) -> Vec<u8> {
    let mut output = vec![0u8; width * height];

    for y in 0..height {
        let top = y.saturating_sub(1);
        let bottom = (y + 1).min(height - 1);
        let top_row = top * width;
        let middle_row = y * width;
        let bottom_row = bottom * width;

        for x in 0..width {
            let left = x.saturating_sub(1);
            let right = (x + 1).min(width - 1);
            let sum = mask[top_row + left] as u16
                + mask[top_row + x] as u16
                + mask[top_row + right] as u16
                + mask[middle_row + left] as u16
                + mask[middle_row + x] as u16
                + mask[middle_row + right] as u16
                + mask[bottom_row + left] as u16
                + mask[bottom_row + x] as u16
                + mask[bottom_row + right] as u16;

            output[middle_row + x] = (sum / 9) as u8;
        }
    }

    output
}

fn despill(value: u8, background: u8, alpha: f32) -> u8 {
    let inverse = 1.0 - alpha;
    let corrected = (value as f32 - inverse * background as f32) / alpha;

    corrected.clamp(0.0, 255.0) as u8
}

/// Removes a uniform border-coloured background and returns a new RGBA buffer.
/// Pixels connected to the border within the sampled colour tolerance become
/// transparent; a one-pixel box blur feathers the matte and edge pixels are
/// de-spilled against the sampled colour.
pub fn remove_background(data: &[u8], width: u32, height: u32) -> Vec<u8> {
    let width = width as usize;
    let height = height as usize;

    if width == 0 || height == 0 {
        return Vec::new();
    }

    let Some(pixels) = width.checked_mul(height) else {
        return Vec::new();
    };
    let Some(expected) = pixels.checked_mul(4) else {
        return Vec::new();
    };

    if data.len() < expected {
        return Vec::new();
    }

    let background = sample_background(data, width, height);
    let low = background_noise(data, width, height, background);
    let high = (low + RANGE).min(255);
    let high_squared = high * high;
    let mut mask = vec![0u8; pixels];
    let mut stack = Vec::with_capacity(pixels / 16 + 1);
    let mut seeded = false;

    for x in 0..width {
        let before = stack.len();

        seed(
            data,
            &mut mask,
            &mut stack,
            width,
            x,
            0,
            background,
            high_squared,
        );

        if height > 1 {
            seed(
                data,
                &mut mask,
                &mut stack,
                width,
                x,
                height - 1,
                background,
                high_squared,
            );
        }

        seeded |= stack.len() != before;
    }

    for y in 1..height.saturating_sub(1) {
        let before = stack.len();

        seed(
            data,
            &mut mask,
            &mut stack,
            width,
            0,
            y,
            background,
            high_squared,
        );

        if width > 1 {
            seed(
                data,
                &mut mask,
                &mut stack,
                width,
                width - 1,
                y,
                background,
                high_squared,
            );
        }

        seeded |= stack.len() != before;
    }

    if !seeded {
        return Vec::new();
    }

    while let Some(index) = stack.pop() {
        let index = index as usize;
        let x = index % width;
        let y = index / width;

        if x > 0 {
            seed(
                data,
                &mut mask,
                &mut stack,
                width,
                x - 1,
                y,
                background,
                high_squared,
            );
        }

        if x + 1 < width {
            seed(
                data,
                &mut mask,
                &mut stack,
                width,
                x + 1,
                y,
                background,
                high_squared,
            );
        }

        if y > 0 {
            seed(
                data,
                &mut mask,
                &mut stack,
                width,
                x,
                y - 1,
                background,
                high_squared,
            );
        }

        if y + 1 < height {
            seed(
                data,
                &mut mask,
                &mut stack,
                width,
                x,
                y + 1,
                background,
                high_squared,
            );
        }
    }

    for pixel in 0..pixels {
        mask[pixel] = if mask[pixel] == 0 { 255 } else { 0 };
    }

    let alpha = feather(&mask, width, height);
    let mut output = data[..expected].to_vec();

    for pixel in 0..pixels {
        let base = pixel * 4;
        let matte = alpha[pixel] as u32;
        let original_alpha = data[base + 3] as u32;

        output[base + 3] = ((matte * original_alpha + 127) / 255) as u8;

        if matte == 0 || matte == 255 {
            continue;
        }

        let normalized = matte as f32 / 255.0;

        output[base] = despill(data[base], background.r, normalized);
        output[base + 1] = despill(data[base + 1], background.g, normalized);
        output[base + 2] = despill(data[base + 2], background.b, normalized);
    }

    output
}

#[cfg(test)]
mod tests {
    use super::remove_background;

    fn rgba(width: usize, height: usize, colour: [u8; 3], centre: [u8; 3]) -> Vec<u8> {
        let mut data = Vec::with_capacity(width * height * 4);

        for y in 0..height {
            for x in 0..width {
                let inside =
                    x >= width / 3 && x < width * 2 / 3 && y >= height / 3 && y < height * 2 / 3;
                let pixel = if inside { centre } else { colour };

                data.extend_from_slice(&[pixel[0], pixel[1], pixel[2], 255]);
            }
        }

        data
    }

    #[test]
    fn removes_a_uniform_border_and_keeps_the_centre() {
        let width = 9;
        let height = 9;
        let data = rgba(width, height, [250, 250, 250], [20, 20, 20]);
        let output = remove_background(&data, width as u32, height as u32);

        assert_eq!(output.len(), data.len());
        assert_eq!(output[3], 0);
        assert_eq!(output[(4 * width + 4) * 4 + 3], 255);
    }

    #[test]
    fn preserves_the_original_alpha_channel() {
        let width = 7;
        let height = 7;
        let mut data = rgba(width, height, [245, 245, 245], [10, 10, 10]);
        let centre = (3 * width + 3) * 4;

        data[centre + 3] = 128;

        let output = remove_background(&data, width as u32, height as u32);

        assert!(output[centre + 3] > 0);
        assert!(output[centre + 3] < 255);
    }

    #[test]
    fn rejects_a_short_buffer() {
        assert!(remove_background(&[0; 8], 2, 2).is_empty());
    }
}
