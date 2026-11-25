use crate::error::{ConvertError, Result};
use crate::limits::MAX_TEXT_BYTES;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: f32,
}

impl Color {
    pub const WHITE: Self = Self {
        r: 255,
        g: 255,
        b: 255,
        a: 1.0,
    };
    pub const BLACK: Self = Self {
        r: 0,
        g: 0,
        b: 0,
        a: 1.0,
    };

    pub const fn rgb(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b, a: 1.0 }
    }

    pub fn components(self) -> [f32; 3] {
        [
            f32::from(self.r) / 255.0,
            f32::from(self.g) / 255.0,
            f32::from(self.b) / 255.0,
        ]
    }
}

impl Default for Color {
    fn default() -> Self {
        Self::BLACK
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FontFamily {
    Sans,
    Serif,
    Mono,
}

impl Default for FontFamily {
    fn default() -> Self {
        Self::Sans
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Align {
    Left,
    Center,
    Right,
}

impl Default for Align {
    fn default() -> Self {
        Self::Left
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Anchor {
    Top,
    Middle,
    Bottom,
}

impl Default for Anchor {
    fn default() -> Self {
        Self::Top
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Geometry {
    Rect,
    RoundRect,
    Ellipse,
    Line,
    Triangle,
    Diamond,
    Parallelogram,
    Trapezoid,
    Hexagon,
    Chevron,
    RightArrow,
    LeftArrow,
    UpArrow,
    DownArrow,
    Star,
}

impl Default for Geometry {
    fn default() -> Self {
        Self::Rect
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Insets {
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
}

impl Default for Insets {
    fn default() -> Self {
        Self {
            left: 7.2,
            top: 3.6,
            right: 7.2,
            bottom: 3.6,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct LineStyle {
    pub color: Color,
    pub width: f32,
    pub dash: Option<&'static [f32]>,
    pub arrow_head: bool,
    pub arrow_tail: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BulletSpec {
    Inherit,
    None,
    Char(char),
    Auto,
}

impl Default for BulletSpec {
    fn default() -> Self {
        Self::Inherit
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Bullet {
    pub character: char,
    pub auto: bool,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct LevelStyle {
    pub size: Option<f32>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub color: Option<Color>,
    pub font: Option<FontFamily>,
    pub align: Option<Align>,
    pub bullet: BulletSpec,
    pub line_spacing: Option<f32>,
    pub space_before: Option<f32>,
    pub space_after: Option<f32>,
    pub margin_left: Option<f32>,
    pub indent: Option<f32>,
}

impl LevelStyle {
    /// Applies `other` on top of this style. Unset fields keep the current value.
    pub fn merge(self, other: Self) -> Self {
        Self {
            size: other.size.or(self.size),
            bold: other.bold.or(self.bold),
            italic: other.italic.or(self.italic),
            underline: other.underline.or(self.underline),
            color: other.color.or(self.color),
            font: other.font.or(self.font),
            align: other.align.or(self.align),
            bullet: if other.bullet == BulletSpec::Inherit {
                self.bullet
            } else {
                other.bullet
            },
            line_spacing: other.line_spacing.or(self.line_spacing),
            space_before: other.space_before.or(self.space_before),
            space_after: other.space_after.or(self.space_after),
            margin_left: other.margin_left.or(self.margin_left),
            indent: other.indent.or(self.indent),
        }
    }

    pub fn resolve(self, fallback: ResolvedStyle) -> ResolvedStyle {
        ResolvedStyle {
            size: self.size.unwrap_or(fallback.size),
            bold: self.bold.unwrap_or(fallback.bold),
            italic: self.italic.unwrap_or(fallback.italic),
            underline: self.underline.unwrap_or(fallback.underline),
            color: self.color.unwrap_or(fallback.color),
            font: self.font.unwrap_or(fallback.font),
            align: self.align.unwrap_or(fallback.align),
            bullet: match self.bullet {
                BulletSpec::Inherit => fallback.bullet,
                BulletSpec::None => None,
                BulletSpec::Char(character) => Some(Bullet {
                    character,
                    auto: false,
                }),
                BulletSpec::Auto => Some(Bullet {
                    character: '•',
                    auto: true,
                }),
            },
            line_spacing: self.line_spacing.unwrap_or(fallback.line_spacing),
            space_before: self.space_before.unwrap_or(fallback.space_before),
            space_after: self.space_after.unwrap_or(fallback.space_after),
            margin_left: self.margin_left.unwrap_or(fallback.margin_left),
            indent: self.indent.unwrap_or(fallback.indent),
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ResolvedStyle {
    pub size: f32,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub color: Color,
    pub font: FontFamily,
    pub align: Align,
    pub bullet: Option<Bullet>,
    pub line_spacing: f32,
    pub space_before: f32,
    pub space_after: f32,
    pub margin_left: f32,
    pub indent: f32,
}

impl Default for ResolvedStyle {
    fn default() -> Self {
        Self {
            size: 18.0,
            bold: false,
            italic: false,
            underline: false,
            color: Color::BLACK,
            font: FontFamily::Sans,
            align: Align::Left,
            bullet: None,
            line_spacing: 1.0,
            space_before: 0.0,
            space_after: 0.0,
            margin_left: 0.0,
            indent: 0.0,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct TextRun {
    pub text_start: u32,
    pub text_len: u32,
    pub size: f32,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub color: Color,
    pub font: FontFamily,
}

#[derive(Clone, Copy, Debug)]
pub struct Paragraph {
    pub run_start: u32,
    pub run_count: u32,
    pub align: Align,
    pub level: u8,
    pub bullet: Option<Bullet>,
    pub space_before: f32,
    pub space_after: f32,
    pub line_spacing: f32,
    pub margin_left: f32,
    pub indent: f32,
    pub base_size: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct TextBox {
    pub paragraph_start: u32,
    pub paragraph_count: u32,
    pub insets: Insets,
    pub anchor: Anchor,
    pub wrap: bool,
}

#[derive(Clone, Debug)]
pub struct Shape {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub rotation: f32,
    pub geometry: Geometry,
    pub fill: Option<Color>,
    pub line: Option<LineStyle>,
    pub text: Option<TextBox>,
    pub image: Option<u32>,
    /// Left, top, right, bottom crop as fractions of the source image.
    pub image_crop: Option<[f32; 4]>,
    pub table: Option<u32>,
}

#[derive(Clone, Debug)]
pub struct Table {
    pub cell_start: u32,
    pub cell_count: u32,
    pub column_widths: Vec<f32>,
    pub row_heights: Vec<f32>,
}

#[derive(Clone, Debug)]
pub struct Cell {
    pub row: u32,
    pub column: u32,
    pub row_span: u32,
    pub column_span: u32,
    pub fill: Option<Color>,
    pub borders: [Option<LineStyle>; 4],
    pub text: Option<TextBox>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImageFormat {
    Png,
    Jpeg,
}

#[derive(Clone, Copy, Debug)]
pub struct MediaSpan {
    pub start: u32,
    pub len: u32,
    pub format: ImageFormat,
}

#[derive(Clone, Debug)]
pub struct Slide {
    pub background: Color,
    pub shape_start: u32,
    pub shape_count: u32,
}

#[derive(Default)]
pub struct Deck {
    pub width: f32,
    pub height: f32,
    pub slides: Vec<Slide>,
    pub shapes: Vec<Shape>,
    pub paragraphs: Vec<Paragraph>,
    pub runs: Vec<TextRun>,
    pub text: String,
    pub tables: Vec<Table>,
    pub cells: Vec<Cell>,
    pub media: Vec<u8>,
    pub media_spans: Vec<MediaSpan>,
}

impl Deck {
    pub fn run_text(&self, run: &TextRun) -> &str {
        let start = run.text_start as usize;
        let end = start + run.text_len as usize;

        &self.text[start..end]
    }

    pub fn paragraph_runs(&self, paragraph: &Paragraph) -> &[TextRun] {
        let start = paragraph.run_start as usize;
        let end = start + paragraph.run_count as usize;

        &self.runs[start..end]
    }

    pub fn push_text(&mut self, text: &str) -> Result<(u32, u32)> {
        if self.text.len() + text.len() > MAX_TEXT_BYTES {
            return Err(ConvertError::TextTooLarge);
        }

        let start = self.text.len() as u32;

        self.text.push_str(text);

        Ok((start, text.len() as u32))
    }
}
