use soa_rs::{Soa, Soars};

pub(crate) const MAX_SAMPLES: usize = 2048;
pub(crate) const MIN_LOW: u32 = 8;
pub(crate) const MAX_LOW: u32 = 40;
pub(crate) const RANGE: u32 = 96;

#[derive(Clone, Copy)]
pub(crate) struct Rgb {
    pub(crate) r: u8,
    pub(crate) g: u8,
    pub(crate) b: u8,
}

#[derive(Soars, Clone, Copy)]
struct Sample {
    r: u8,
    g: u8,
    b: u8,
}

fn median(values: &[u8]) -> u8 {
    let mut histogram = [0u32; 256];

    for value in values {
        histogram[*value as usize] += 1;
    }

    let target = (values.len() / 2) as u32;
    let mut seen = 0u32;

    for (value, frequency) in histogram.iter().enumerate() {
        seen += *frequency;

        if seen > target {
            return value as u8;
        }
    }

    255
}

pub(crate) fn sample_background(data: &[u8], width: usize, height: usize) -> Rgb {
    let step = ((width + height) / MAX_SAMPLES).max(1);
    let mut samples: Soa<Sample> = Soa::with_capacity(MAX_SAMPLES + 4);

    let mut add = |x: usize, y: usize| {
        let index = (y * width + x) * 4;

        samples.push(Sample {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2],
        });
    };

    for x in (0..width).step_by(step) {
        add(x, 0);

        if height > 1 {
            add(x, height - 1);
        }
    }

    for y in (step..height.saturating_sub(step)).step_by(step) {
        add(0, y);

        if width > 1 {
            add(width - 1, y);
        }
    }

    if samples.is_empty() {
        return Rgb {
            r: 255,
            g: 255,
            b: 255,
        };
    }

    Rgb {
        r: median(samples.r()),
        g: median(samples.g()),
        b: median(samples.b()),
    }
}

pub(crate) fn squared_distance(data: &[u8], index: usize, background: Rgb) -> u32 {
    let red = data[index] as i32 - background.r as i32;
    let green = data[index + 1] as i32 - background.g as i32;
    let blue = data[index + 2] as i32 - background.b as i32;

    (red * red + green * green + blue * blue) as u32
}

pub(crate) fn background_noise(data: &[u8], width: usize, height: usize, background: Rgb) -> u32 {
    let step = ((width + height) / MAX_SAMPLES).max(1);
    let mut distances = Vec::with_capacity(MAX_SAMPLES + 4);

    let mut add = |x: usize, y: usize| {
        let index = (y * width + x) * 4;

        distances.push(squared_distance(data, index, background));
    };

    for x in (0..width).step_by(step) {
        add(x, 0);

        if height > 1 {
            add(x, height - 1);
        }
    }

    for y in (step..height.saturating_sub(step)).step_by(step) {
        add(0, y);

        if width > 1 {
            add(width - 1, y);
        }
    }

    if distances.is_empty() {
        return MIN_LOW;
    }

    distances.sort_unstable();

    let p90 = distances[(distances.len() - 1) * 9 / 10];
    let low = ((p90 as f64).sqrt() * 1.5 + 4.0) as u32;

    low.clamp(MIN_LOW, MAX_LOW)
}
