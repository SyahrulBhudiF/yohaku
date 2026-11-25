use roxmltree::Node;

use crate::model::Color;
use crate::package::{attribute, child};

const SCHEME_NAMES: [&str; 12] = [
    "dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
    "hlink", "folHlink",
];

#[derive(Clone, Debug)]
pub struct Theme {
    pub colors: [Color; 12],
    pub major_font: String,
    pub minor_font: String,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            colors: [
                Color::BLACK,
                Color::WHITE,
                Color::rgb(0x44, 0x54, 0x6a),
                Color::rgb(0xe7, 0xe6, 0xe6),
                Color::rgb(0x44, 0x72, 0xc4),
                Color::rgb(0xed, 0x7d, 0x31),
                Color::rgb(0xa5, 0xa5, 0xa5),
                Color::rgb(0xff, 0xc0, 0x00),
                Color::rgb(0x5b, 0x9b, 0xd5),
                Color::rgb(0x70, 0xad, 0x47),
                Color::rgb(0x05, 0x63, 0xc1),
                Color::rgb(0x95, 0x4f, 0x72),
            ],
            major_font: "Calibri Light".into(),
            minor_font: "Calibri".into(),
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ColorMap {
    slots: [usize; 12],
}

impl Default for ColorMap {
    fn default() -> Self {
        Self {
            slots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        }
    }
}

impl ColorMap {
    pub fn apply(&mut self, node: Node) {
        for alias in [
            "bg1", "tx1", "bg2", "tx2", "accent1", "accent2", "accent3", "accent4", "accent5",
            "accent6", "hlink", "folHlink",
        ] {
            if let Some(value) = attribute(node, alias) {
                if let (Some(alias_index), Some(target_index)) =
                    (scheme_index(alias), scheme_index(value))
                {
                    self.slots[alias_index] = target_index;
                }
            }
        }
    }

    pub fn index(&self, name: &str) -> Option<usize> {
        scheme_index(name).map(|index| self.slots[index])
    }
}

fn scheme_index(name: &str) -> Option<usize> {
    match name {
        "dk1" | "tx1" => Some(0),
        "lt1" | "bg1" => Some(1),
        "dk2" | "tx2" => Some(2),
        "lt2" | "bg2" => Some(3),
        "accent1" => Some(4),
        "accent2" => Some(5),
        "accent3" => Some(6),
        "accent4" => Some(7),
        "accent5" => Some(8),
        "accent6" => Some(9),
        "hlink" => Some(10),
        "folHlink" => Some(11),
        _ => None,
    }
}

pub fn parse_theme(xml: &str) -> Theme {
    let mut theme = Theme::default();
    let Ok(document) = roxmltree::Document::parse(xml) else {
        return theme;
    };

    if let Some(scheme) = document
        .descendants()
        .find(|node| node.is_element() && node.tag_name().name() == "clrScheme")
    {
        for (index, name) in SCHEME_NAMES.iter().enumerate() {
            if let Some(slot) = scheme
                .children()
                .find(|node| node.is_element() && node.tag_name().name() == *name)
            {
                if let Some(color) = slot
                    .children()
                    .find(|node| node.is_element())
                    .and_then(|node| parse_color_node(node, &theme, &ColorMap::default()))
                {
                    theme.colors[index] = color;
                }
            }
        }
    }

    if let Some(fonts) = document
        .descendants()
        .find(|node| node.is_element() && node.tag_name().name() == "fontScheme")
    {
        for (name, target) in [
            ("majorFont", &mut theme.major_font),
            ("minorFont", &mut theme.minor_font),
        ] {
            if let Some(font) = fonts
                .children()
                .find(|node| node.is_element() && node.tag_name().name() == name)
                .and_then(|node| child(node, "latin"))
                .and_then(|latin| attribute(latin, "typeface"))
            {
                *target = font.to_string();
            }
        }
    }

    theme
}

/// Reads a fill element (`a:solidFill`, `a:gradFill`, `a:noFill`, ...).
pub fn parse_fill_element(fill: Node, theme: &Theme, map: &ColorMap) -> Option<Color> {
    match fill.tag_name().name() {
        "solidFill" => fill
            .children()
            .find(|child| child.is_element())
            .and_then(|child| parse_color_node(child, theme, map)),
        "gradFill" => fill
            .descendants()
            .find(|child| {
                child.is_element()
                    && matches!(
                        child.tag_name().name(),
                        "srgbClr" | "schemeClr" | "sysClr" | "scrgbClr" | "prstClr"
                    )
            })
            .and_then(|child| parse_color_node(child, theme, map)),
        _ => None,
    }
}

/// Finds a fill among the direct children of a shape or run properties.
pub fn parse_fill_children(node: Node, theme: &Theme, map: &ColorMap) -> Option<Color> {
    node.children()
        .find(|child| {
            child.is_element()
                && matches!(child.tag_name().name(), "solidFill" | "gradFill" | "noFill")
        })
        .and_then(|fill| parse_fill_element(fill, theme, map))
}

pub fn parse_color_node(node: Node, theme: &Theme, map: &ColorMap) -> Option<Color> {
    let mut color = match node.tag_name().name() {
        "srgbClr" => parse_hex(attribute(node, "val")?)?,
        "sysClr" => parse_hex(attribute(node, "lastClr")?)?,
        "schemeClr" => {
            let name = attribute(node, "val")?;
            let index = map.index(name)?;

            theme.colors.get(index).copied()?
        }
        "prstClr" => preset_color(attribute(node, "val")?)?,
        "scrgbClr" => {
            let r = percentage(attribute(node, "r")?);
            let g = percentage(attribute(node, "g")?);
            let b = percentage(attribute(node, "b")?);

            Color::rgb(r, g, b)
        }
        _ => return None,
    };

    for modifier in node.children().filter(|child| child.is_element()) {
        let value = attribute(modifier, "val")
            .and_then(|value| value.parse::<f32>().ok())
            .map(|value| value / 100_000.0);

        let Some(value) = value else {
            continue;
        };

        match modifier.tag_name().name() {
            "alpha" => color.a *= value.clamp(0.0, 1.0),
            "lumMod" => color = adjust_luminance(color, value, 0.0),
            "lumOff" => color = adjust_luminance(color, 1.0, value),
            "tint" => {
                color.r = mix_toward(color.r, 255, value);
                color.g = mix_toward(color.g, 255, value);
                color.b = mix_toward(color.b, 255, value);
            }
            "shade" => {
                color.r = mix_toward(color.r, 0, value);
                color.g = mix_toward(color.g, 0, value);
                color.b = mix_toward(color.b, 0, value);
            }
            _ => {}
        }
    }

    Some(color)
}

pub fn parse_hex(value: &str) -> Option<Color> {
    if value.len() != 6 {
        return None;
    }

    let r = u8::from_str_radix(&value[0..2], 16).ok()?;
    let g = u8::from_str_radix(&value[2..4], 16).ok()?;
    let b = u8::from_str_radix(&value[4..6], 16).ok()?;

    Some(Color::rgb(r, g, b))
}

fn percentage(value: &str) -> u8 {
    value
        .parse::<f32>()
        .map(|value| (value / 100_000.0 * 255.0).clamp(0.0, 255.0) as u8)
        .unwrap_or(0)
}

fn mix_toward(value: u8, target: u8, amount: f32) -> u8 {
    let value = f32::from(value);
    let target = f32::from(target);

    (value + (target - value) * amount.clamp(0.0, 1.0)).round() as u8
}

fn adjust_luminance(color: Color, multiplier: f32, offset: f32) -> Color {
    let (hue, saturation, luminance) = rgb_to_hsl(color);
    let luminance = (luminance * multiplier + offset).clamp(0.0, 1.0);
    let (r, g, b) = hsl_to_rgb(hue, saturation, luminance);

    Color {
        r,
        g,
        b,
        a: color.a,
    }
}

fn rgb_to_hsl(color: Color) -> (f32, f32, f32) {
    let r = f32::from(color.r) / 255.0;
    let g = f32::from(color.g) / 255.0;
    let b = f32::from(color.b) / 255.0;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let luminance = (max + min) / 2.0;

    if (max - min).abs() < f32::EPSILON {
        return (0.0, 0.0, luminance);
    }

    let delta = max - min;
    let saturation = if luminance > 0.5 {
        delta / (2.0 - max - min)
    } else {
        delta / (max + min)
    };
    let hue = if max == r {
        ((g - b) / delta + if g < b { 6.0 } else { 0.0 }) / 6.0
    } else if max == g {
        ((b - r) / delta + 2.0) / 6.0
    } else {
        ((r - g) / delta + 4.0) / 6.0
    };

    (hue, saturation, luminance)
}

fn hsl_to_rgb(hue: f32, saturation: f32, luminance: f32) -> (u8, u8, u8) {
    if saturation.abs() < f32::EPSILON {
        let value = (luminance * 255.0).round() as u8;

        return (value, value, value);
    }

    let q = if luminance < 0.5 {
        luminance * (1.0 + saturation)
    } else {
        luminance + saturation - luminance * saturation
    };
    let p = 2.0 * luminance - q;

    (
        (hue_to_rgb(p, q, hue + 1.0 / 3.0) * 255.0).round() as u8,
        (hue_to_rgb(p, q, hue) * 255.0).round() as u8,
        (hue_to_rgb(p, q, hue - 1.0 / 3.0) * 255.0).round() as u8,
    )
}

fn hue_to_rgb(p: f32, q: f32, mut t: f32) -> f32 {
    if t < 0.0 {
        t += 1.0;
    }

    if t > 1.0 {
        t -= 1.0;
    }

    if t < 1.0 / 6.0 {
        p + (q - p) * 6.0 * t
    } else if t < 0.5 {
        q
    } else if t < 2.0 / 3.0 {
        p + (q - p) * (2.0 / 3.0 - t) * 6.0
    } else {
        p
    }
}

fn preset_color(name: &str) -> Option<Color> {
    let value = match name {
        "black" => 0x000000,
        "white" => 0xffffff,
        "red" => 0xff0000,
        "green" => 0x008000,
        "blue" => 0x0000ff,
        "yellow" => 0xffff00,
        "gray" | "grey" => 0x808080,
        "darkGray" | "darkGrey" => 0xa9a9a9,
        "lightGray" | "lightGrey" => 0xd3d3d3,
        "orange" => 0xffa500,
        "purple" => 0x800080,
        "cyan" => 0x00ffff,
        "magenta" => 0xff00ff,
        "brown" => 0xa52a2a,
        "pink" => 0xffc0cb,
        "navy" => 0x000080,
        "teal" => 0x008080,
        "olive" => 0x808000,
        "maroon" => 0x800000,
        "silver" => 0xc0c0c0,
        _ => return None,
    };

    Some(Color::rgb(
        ((value >> 16) & 0xff) as u8,
        ((value >> 8) & 0xff) as u8,
        (value & 0xff) as u8,
    ))
}
