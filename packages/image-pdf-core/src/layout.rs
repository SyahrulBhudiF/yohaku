use soa_rs::{Soa, Soars};

const A4_SHORT_SIDE: f32 = 595.28;
const A4_LONG_SIDE: f32 = 841.89;
const FIT_LONG_SIDE: f32 = 842.0;
const A4_MARGIN: f32 = 24.0;

#[derive(Soars, Clone, Copy)]
pub(crate) struct PageLayout {
    pub(crate) page_width: f32,
    pub(crate) page_height: f32,
    pub(crate) draw_width: f32,
    pub(crate) draw_height: f32,
    pub(crate) x: f32,
    pub(crate) y: f32,
}

pub(crate) fn layout_pages(images: &[(u32, u32)], page_size: &str) -> Soa<PageLayout> {
    let mut layouts: Soa<PageLayout> = Soa::with_capacity(images.len());

    for &(width, height) in images {
        layouts.push(layout_page(width as f32, height as f32, page_size));
    }

    layouts
}

fn layout_page(width: f32, height: f32, page_size: &str) -> PageLayout {
    if page_size != "a4" {
        let scale = FIT_LONG_SIDE / width.max(height);

        return PageLayout {
            page_width: width * scale,
            page_height: height * scale,
            draw_width: width * scale,
            draw_height: height * scale,
            x: 0.0,
            y: 0.0,
        };
    }

    let landscape = width > height;
    let page_width = if landscape {
        A4_LONG_SIDE
    } else {
        A4_SHORT_SIDE
    };
    let page_height = if landscape {
        A4_SHORT_SIDE
    } else {
        A4_LONG_SIDE
    };
    let scale =
        ((page_width - A4_MARGIN * 2.0) / width).min((page_height - A4_MARGIN * 2.0) / height);
    let draw_width = width * scale;
    let draw_height = height * scale;

    PageLayout {
        page_width,
        page_height,
        draw_width,
        draw_height,
        x: (page_width - draw_width) / 2.0,
        y: (page_height - draw_height) / 2.0,
    }
}
