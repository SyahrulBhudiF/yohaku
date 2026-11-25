use roxmltree::Node;

use crate::color::{parse_fill_children, ColorMap, Theme};
use crate::error::{ConvertError, Result};
use crate::limits::{MAX_PARAGRAPHS, MAX_RUNS};
use crate::model::{
    Align, Anchor, BulletSpec, FontFamily, Insets, LevelStyle, Paragraph, ResolvedStyle, TextBox,
    TextRun,
};
use crate::package::{attribute, child, children};

const EMU_PER_POINT: f32 = 12_700.0;

pub fn parse_level_styles(container: Node, theme: &Theme, map: &ColorMap) -> [LevelStyle; 9] {
    let mut styles = [LevelStyle::default(); 9];

    for node in container.children().filter(|node| node.is_element()) {
        let name = node.tag_name().name();

        if let Some(index) = level_index(name) {
            styles[index] = parse_paragraph_style(node, theme, map);
        }
    }

    styles
}

fn level_index(name: &str) -> Option<usize> {
    let level = name.strip_prefix("lvl")?.strip_suffix("pPr")?;

    level
        .parse::<usize>()
        .ok()?
        .checked_sub(1)
        .filter(|index| *index < 9)
}

pub fn parse_paragraph_style(node: Node, theme: &Theme, map: &ColorMap) -> LevelStyle {
    let mut style = LevelStyle::default();

    if let Some(align) = attribute(node, "algn") {
        style.align = Some(match align {
            "ctr" => Align::Center,
            "r" => Align::Right,
            _ => Align::Left,
        });
    }

    if let Some(margin) = emu(attribute(node, "marL")) {
        style.margin_left = Some(margin);
    }

    if let Some(indent) = emu(attribute(node, "indent")) {
        style.indent = Some(indent);
    }

    if let Some(spacing) = child(node, "lnSpc").and_then(|node| child(node, "spcPct")) {
        if let Some(value) = attribute(spacing, "val").and_then(|value| value.parse::<f32>().ok()) {
            style.line_spacing = Some((value / 100_000.0).clamp(0.4, 4.0));
        }
    }

    if let Some(spacing) = child(node, "spcBef").and_then(|node| child(node, "spcPts")) {
        if let Some(value) = attribute(spacing, "val").and_then(|value| value.parse::<f32>().ok()) {
            style.space_before = Some((value / 100.0).max(0.0));
        }
    }

    if let Some(spacing) = child(node, "spcAft").and_then(|node| child(node, "spcPts")) {
        if let Some(value) = attribute(spacing, "val").and_then(|value| value.parse::<f32>().ok()) {
            style.space_after = Some((value / 100.0).max(0.0));
        }
    }

    if child(node, "buNone").is_some() {
        style.bullet = BulletSpec::None;
    } else if let Some(bullet) = child(node, "buChar") {
        if let Some(character) = attribute(bullet, "char").and_then(|value| value.chars().next()) {
            style.bullet = BulletSpec::Char(character);
        }
    } else if child(node, "buAutoNum").is_some() {
        style.bullet = BulletSpec::Auto;
    }

    if let Some(run) = child(node, "defRPr") {
        style = style.merge(parse_run_style(run, theme, map));
    }

    style
}

pub fn parse_run_style(node: Node, theme: &Theme, map: &ColorMap) -> LevelStyle {
    let mut style = LevelStyle::default();

    if let Some(size) = attribute(node, "sz").and_then(|value| value.parse::<f32>().ok()) {
        style.size = Some((size / 100.0).clamp(1.0, 400.0));
    }

    if let Some(bold) = attribute(node, "b") {
        style.bold = Some(bold == "1" || bold == "true");
    }

    if let Some(italic) = attribute(node, "i") {
        style.italic = Some(italic == "1" || italic == "true");
    }

    if let Some(underline) = attribute(node, "u") {
        style.underline = Some(underline != "none");
    }

    if let Some(color) = parse_fill_children(node, theme, map) {
        style.color = Some(color);
    }

    if let Some(latin) = child(node, "latin") {
        if let Some(typeface) = attribute(latin, "typeface") {
            style.font = Some(font_family(typeface, theme));
        }
    }

    style
}

pub fn font_family(typeface: &str, theme: &Theme) -> FontFamily {
    let name = match typeface {
        "+mj-lt" | "+mj-ea" | "+mj-cs" => theme.major_font.as_str(),
        "+mn-lt" | "+mn-ea" | "+mn-cs" => theme.minor_font.as_str(),
        other => other,
    }
    .to_ascii_lowercase();

    if name.contains("courier")
        || name.contains("consolas")
        || name.contains("mono")
        || name.contains("menlo")
        || name.contains("code")
    {
        FontFamily::Mono
    } else if name.contains("times")
        || name.contains("georgia")
        || name.contains("serif")
        || name.contains("cambria")
        || name.contains("garamond")
        || name.contains("book antiqua")
    {
        FontFamily::Serif
    } else {
        FontFamily::Sans
    }
}

pub fn parse_text_body(
    deck: &mut crate::model::Deck,
    node: Node,
    inherited: &[LevelStyle; 9],
    default_insets: Insets,
    default_anchor: Anchor,
    theme: &Theme,
    map: &ColorMap,
) -> Result<Option<TextBox>> {
    let body_pr = child(node, "bodyPr");
    let mut styles = *inherited;

    if let Some(list) = child(node, "lstStyle") {
        let overrides = parse_level_styles(list, theme, map);

        for (style, override_style) in styles.iter_mut().zip(overrides.iter()) {
            *style = style.merge(*override_style);
        }
    }

    let insets = Insets {
        left: emu(body_pr.and_then(|node| attribute(node, "lIns"))).unwrap_or(default_insets.left),
        top: emu(body_pr.and_then(|node| attribute(node, "tIns"))).unwrap_or(default_insets.top),
        right: emu(body_pr.and_then(|node| attribute(node, "rIns")))
            .unwrap_or(default_insets.right),
        bottom: emu(body_pr.and_then(|node| attribute(node, "bIns")))
            .unwrap_or(default_insets.bottom),
    };
    let anchor = match body_pr.and_then(|node| attribute(node, "anchor")) {
        Some("ctr") => Anchor::Middle,
        Some("b") => Anchor::Bottom,
        Some("t") => Anchor::Top,
        _ => default_anchor,
    };
    let wrap = body_pr.and_then(|node| attribute(node, "wrap")) != Some("none");
    let paragraph_start = deck.paragraphs.len() as u32;
    let mut paragraph_count = 0u32;

    for paragraph in children(node, "p") {
        if deck.paragraphs.len() >= MAX_PARAGRAPHS {
            return Err(ConvertError::TooManyShapes);
        }

        let props = child(paragraph, "pPr");
        let level = props
            .and_then(|node| attribute(node, "lvl"))
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0)
            .min(8);
        let paragraph_style = props
            .map(|node| parse_paragraph_style(node, theme, map))
            .unwrap_or_default();
        let style = styles[level].merge(paragraph_style);
        let resolved = style.resolve(ResolvedStyle::default());
        let run_start = deck.runs.len() as u32;
        let mut run_count = 0u32;

        for run in paragraph.children().filter(|node| node.is_element()) {
            let (text, run_props) = match run.tag_name().name() {
                "r" | "fld" => {
                    let text = child(run, "t")
                        .and_then(|node| node.text())
                        .unwrap_or_default()
                        .replace('\u{000B}', "\n");
                    let props = child(run, "rPr")
                        .map(|node| parse_run_style(node, theme, map))
                        .unwrap_or_default();

                    (text, props)
                }
                "br" => ("\n".to_string(), LevelStyle::default()),
                _ => continue,
            };

            let run_style = style.merge(run_props).resolve(resolved);
            let text = if attribute(child(run, "rPr").unwrap_or(run), "cap") == Some("all") {
                text.to_uppercase()
            } else {
                text
            };

            if text.is_empty() {
                continue;
            }

            if deck.runs.len() >= MAX_RUNS {
                return Err(ConvertError::TooManyShapes);
            }

            let (text_start, text_len) = deck.push_text(&text)?;

            deck.runs.push(TextRun {
                text_start,
                text_len,
                size: run_style.size,
                bold: run_style.bold,
                italic: run_style.italic,
                underline: run_style.underline,
                color: run_style.color,
                font: run_style.font,
            });
            run_count += 1;
        }

        deck.paragraphs.push(Paragraph {
            run_start,
            run_count,
            align: resolved.align,
            level: level as u8,
            bullet: resolved.bullet,
            space_before: resolved.space_before,
            space_after: resolved.space_after,
            line_spacing: resolved.line_spacing,
            margin_left: resolved.margin_left,
            indent: resolved.indent,
            base_size: resolved.size,
        });
        paragraph_count += 1;
    }

    if paragraph_count == 0 {
        return Ok(None);
    }

    Ok(Some(TextBox {
        paragraph_start,
        paragraph_count,
        insets,
        anchor,
        wrap,
    }))
}

pub fn emu(value: Option<&str>) -> Option<f32> {
    value
        .and_then(|value| value.parse::<f32>().ok())
        .map(|value| value / EMU_PER_POINT)
}
