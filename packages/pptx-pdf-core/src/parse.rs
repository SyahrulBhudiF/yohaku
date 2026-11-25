use std::collections::HashMap;

use roxmltree::{Document, Node};

use crate::color::{
    parse_color_node, parse_fill_children, parse_fill_element, parse_theme, ColorMap, Theme,
};
use crate::error::{ConvertError, Result};
use crate::limits::{MAX_IMAGES, MAX_IMAGE_PIXELS, MAX_SHAPES, MAX_SLIDES, MAX_TABLE_CELLS};
use crate::model::{
    Anchor, Cell, Color, Deck, Geometry, ImageFormat, Insets, LevelStyle, LineStyle, MediaSpan,
    Shape, Slide, Table,
};
use crate::package::{
    attribute, child, children, descendant, relationship_id, Package, Relationship,
};
use crate::text::{emu, parse_level_styles, parse_text_body};

#[derive(Clone, Copy, Debug)]
struct Rect {
    x: f32,
    y: f32,
    width: f32,
    height: f32,
}

#[derive(Clone, Copy, Debug)]
struct Transform {
    sx: f32,
    sy: f32,
    tx: f32,
    ty: f32,
}

impl Transform {
    const IDENTITY: Self = Self {
        sx: 1.0,
        sy: 1.0,
        tx: 0.0,
        ty: 0.0,
    };

    fn map(self, rect: Rect) -> Rect {
        Rect {
            x: self.tx + rect.x * self.sx,
            y: self.ty + rect.y * self.sy,
            width: rect.width * self.sx,
            height: rect.height * self.sy,
        }
    }

    fn compose(self, child: Self) -> Self {
        Self {
            sx: child.sx * self.sx,
            sy: child.sy * self.sy,
            tx: self.tx + child.tx * self.sx,
            ty: self.ty + child.ty * self.sy,
        }
    }
}

#[derive(Clone)]
struct PlaceholderInfo {
    idx: Option<u32>,
    kind: String,
    rect: Option<Rect>,
    styles: [LevelStyle; 9],
    insets: Option<Insets>,
    anchor: Option<Anchor>,
}

#[derive(Clone)]
struct LayoutInfo {
    placeholders: Vec<PlaceholderInfo>,
    background: Option<Color>,
    master_path: Option<String>,
}

#[derive(Clone)]
struct MasterInfo {
    placeholders: Vec<PlaceholderInfo>,
    styles: MasterStyles,
    color_map: ColorMap,
    background: Option<Color>,
}

#[derive(Clone, Copy)]
struct MasterStyles {
    title: [LevelStyle; 9],
    body: [LevelStyle; 9],
    other: [LevelStyle; 9],
}

impl Default for MasterStyles {
    fn default() -> Self {
        let mut title = [LevelStyle::default(); 9];
        let mut body = [LevelStyle::default(); 9];
        let mut other = [LevelStyle::default(); 9];

        for level in title.iter_mut() {
            level.size = Some(44.0);
            level.bold = Some(true);
        }

        for level in body.iter_mut() {
            level.size = Some(28.0);
            level.bullet = crate::model::BulletSpec::Char('•');
        }

        for level in other.iter_mut() {
            level.size = Some(18.0);
        }

        Self { title, body, other }
    }
}

impl MasterStyles {
    fn for_kind(self, kind: &str) -> [LevelStyle; 9] {
        match kind {
            "title" | "ctrTitle" => self.title,
            "body" | "subTitle" | "obj" => self.body,
            _ => self.other,
        }
    }
}

struct PresentationInfo {
    width: f32,
    height: f32,
    slide_paths: Vec<String>,
    master_path: Option<String>,
    theme_path: Option<String>,
    default_styles: [LevelStyle; 9],
}

pub struct Parser<'a> {
    package: Package<'a>,
    deck: Deck,
    theme: Theme,
    color_map: ColorMap,
    master_styles: MasterStyles,
    master_placeholders: Vec<PlaceholderInfo>,
    master_background: Option<Color>,
    layout_cache: HashMap<String, LayoutInfo>,
    master_cache: HashMap<String, MasterInfo>,
    media_cache: HashMap<String, u32>,
}

pub fn parse(bytes: &[u8]) -> Result<Deck> {
    Parser::new(bytes)?.run()
}

impl<'a> Parser<'a> {
    fn new(bytes: &'a [u8]) -> Result<Self> {
        Ok(Self {
            package: Package::new(bytes)?,
            deck: Deck::default(),
            theme: Theme::default(),
            color_map: ColorMap::default(),
            master_styles: MasterStyles::default(),
            master_placeholders: Vec::new(),
            master_background: None,
            layout_cache: HashMap::new(),
            master_cache: HashMap::new(),
            media_cache: HashMap::new(),
        })
    }

    fn run(mut self) -> Result<Deck> {
        let presentation_path = self.package.office_document()?;
        let presentation = self.read_presentation(&presentation_path)?;
        let master_path = presentation
            .master_path
            .clone()
            .or_else(|| self.first_relationship_kind(&presentation_path, "/slideMaster"));

        if let Some(path) = master_path.as_deref() {
            if presentation.theme_path.is_none() {
                if let Some(theme_path) = self.first_relationship_kind(path, "/theme") {
                    self.theme = parse_theme(&self.package.read_xml(&theme_path)?);
                }
            }
        }

        if let Some(theme_path) = presentation.theme_path.as_deref() {
            self.theme = parse_theme(&self.package.read_xml(theme_path)?);
        }

        if let Some(path) = master_path.as_deref() {
            let master = self.parse_master(path)?;

            self.color_map = master.color_map;
            self.master_styles = master.styles;
            self.master_placeholders = master.placeholders;
            self.master_background = master.background;
        }

        for (index, default_style) in presentation.default_styles.iter().enumerate() {
            self.master_styles.other[index] = default_style.merge(self.master_styles.other[index]);
        }

        self.deck.width = presentation.width;
        self.deck.height = presentation.height;

        if presentation.slide_paths.is_empty() {
            return Err(ConvertError::NoSlides);
        }

        if presentation.slide_paths.len() > MAX_SLIDES {
            return Err(ConvertError::TooManySlides);
        }

        for path in presentation.slide_paths {
            self.parse_slide(&path)?;
        }

        Ok(self.deck)
    }

    fn read_presentation(&mut self, path: &str) -> Result<PresentationInfo> {
        let xml = self.package.read_xml(path)?;
        let document = Document::parse(&xml).map_err(|_| ConvertError::InvalidPresentation)?;
        let root = document.root_element();
        let (width, height) = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "sldSz")
            .map(|node| {
                (
                    emu(attribute(node, "cx")).unwrap_or(960.0),
                    emu(attribute(node, "cy")).unwrap_or(540.0),
                )
            })
            .unwrap_or((960.0, 540.0));
        let relationships = self.package.relationships(path)?;
        let mut slide_paths = Vec::new();

        if let Some(list) = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "sldIdLst")
        {
            for slide in children(list, "sldId") {
                if let Some(id) = relationship_id(slide) {
                    if let Some(relationship) = relationships.get(id) {
                        if !relationship.external {
                            slide_paths.push(relationship.target.clone());
                        }
                    }
                }
            }
        }

        let master_path = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "sldMasterIdLst")
            .and_then(|list| child(list, "sldMasterId"))
            .and_then(relationship_id)
            .and_then(|id| relationships.get(id))
            .filter(|relationship| !relationship.external)
            .map(|relationship| relationship.target.clone());
        let theme_path = relationships
            .values()
            .find(|relationship| relationship.kind.ends_with("/theme") && !relationship.external)
            .map(|relationship| relationship.target.clone());
        let default_styles = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "defaultTextStyle")
            .map(|node| parse_level_styles(node, &self.theme, &self.color_map))
            .unwrap_or_default();

        Ok(PresentationInfo {
            width: width.clamp(72.0, 2_000.0),
            height: height.clamp(72.0, 2_000.0),
            slide_paths,
            master_path,
            theme_path,
            default_styles,
        })
    }

    fn first_relationship_kind(&mut self, part: &str, suffix: &str) -> Option<String> {
        self.package
            .relationships(part)
            .ok()
            .and_then(|relationships| {
                relationships
                    .values()
                    .find(|relationship| {
                        relationship.kind.ends_with(suffix) && !relationship.external
                    })
                    .map(|relationship| relationship.target.clone())
            })
    }

    fn parse_master(&mut self, path: &str) -> Result<MasterInfo> {
        if let Some(master) = self.master_cache.get(path) {
            return Ok(master.clone());
        }

        let xml = self.package.read_xml(path)?;
        let document = Document::parse(&xml).map_err(|_| ConvertError::InvalidPresentation)?;
        let root = document.root_element();
        let mut color_map = ColorMap::default();

        if let Some(node) = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "clrMap")
        {
            color_map.apply(node);
        }

        let mut styles = MasterStyles::default();

        if let Some(node) = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "txStyles")
        {
            for (name, target) in [
                ("titleStyle", &mut styles.title),
                ("bodyStyle", &mut styles.body),
                ("otherStyle", &mut styles.other),
            ] {
                if let Some(style) = node
                    .children()
                    .find(|child| child.is_element() && child.tag_name().name() == name)
                {
                    let parsed = parse_level_styles(style, &self.theme, &color_map);

                    for (index, level) in parsed.iter().enumerate() {
                        target[index] = target[index].merge(*level);
                    }
                }
            }
        }

        let c_sld = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "cSld");
        let background = c_sld.and_then(|node| self.parse_background(node, &color_map));
        let placeholders = c_sld
            .and_then(|node| child(node, "spTree"))
            .map(|tree| self.parse_placeholder_list(tree, &color_map))
            .unwrap_or_default();
        let master = MasterInfo {
            placeholders,
            styles,
            color_map,
            background,
        };

        self.master_cache.insert(path.to_string(), master.clone());

        Ok(master)
    }

    fn parse_layout(&mut self, path: &str) -> Result<LayoutInfo> {
        if let Some(layout) = self.layout_cache.get(path) {
            return Ok(layout.clone());
        }

        let xml = self.package.read_xml(path)?;
        let document = Document::parse(&xml).map_err(|_| ConvertError::InvalidPresentation)?;
        let root = document.root_element();
        let relationships = self.package.relationships(path)?;
        let master_path = relationships
            .values()
            .find(|relationship| {
                relationship.kind.ends_with("/slideMaster") && !relationship.external
            })
            .map(|relationship| relationship.target.clone());
        let color_map = master_path
            .as_deref()
            .and_then(|path| self.parse_master(path).ok())
            .map(|master| master.color_map)
            .unwrap_or(self.color_map);
        let c_sld = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "cSld");
        let background = c_sld.and_then(|node| self.parse_background(node, &color_map));
        let placeholders = c_sld
            .and_then(|node| child(node, "spTree"))
            .map(|tree| self.parse_placeholder_list(tree, &color_map))
            .unwrap_or_default();
        let layout = LayoutInfo {
            placeholders,
            background,
            master_path,
        };

        self.layout_cache.insert(path.to_string(), layout.clone());

        Ok(layout)
    }

    fn parse_placeholder_list(&self, tree: Node, color_map: &ColorMap) -> Vec<PlaceholderInfo> {
        tree.descendants()
            .filter(|node| node.is_element() && node.tag_name().name() == "sp")
            .filter_map(|shape| self.parse_placeholder(shape, color_map))
            .collect()
    }

    fn parse_placeholder(&self, shape: Node, color_map: &ColorMap) -> Option<PlaceholderInfo> {
        let ph = descendant(shape, "ph")?;
        let kind = attribute(ph, "type").unwrap_or("body").to_string();
        let idx = attribute(ph, "idx").and_then(|value| value.parse::<u32>().ok());
        let sp_pr = child(shape, "spPr");
        let rect = sp_pr.and_then(|node| parse_rect(node, Transform::IDENTITY));
        let (styles, insets, anchor) = shape
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "txBody")
            .map(|body| {
                let styles = child(body, "lstStyle")
                    .map(|list| parse_level_styles(list, &self.theme, color_map))
                    .unwrap_or_default();
                let body_pr = child(body, "bodyPr");
                let insets = body_pr.map(|node| Insets {
                    left: emu(attribute(node, "lIns")).unwrap_or(7.2),
                    top: emu(attribute(node, "tIns")).unwrap_or(3.6),
                    right: emu(attribute(node, "rIns")).unwrap_or(7.2),
                    bottom: emu(attribute(node, "bIns")).unwrap_or(3.6),
                });
                let anchor = body_pr.and_then(|node| match attribute(node, "anchor") {
                    Some("ctr") => Some(Anchor::Middle),
                    Some("b") => Some(Anchor::Bottom),
                    Some("t") => Some(Anchor::Top),
                    _ => None,
                });

                (styles, insets, anchor)
            })
            .unwrap_or(([LevelStyle::default(); 9], None, None));

        Some(PlaceholderInfo {
            idx,
            kind,
            rect,
            styles,
            insets,
            anchor,
        })
    }

    fn parse_slide(&mut self, path: &str) -> Result<()> {
        let xml = self.package.read_xml(path)?;
        let document = Document::parse(&xml).map_err(|_| ConvertError::InvalidPresentation)?;
        let root = document.root_element();
        let relationships = self.package.relationships(path)?;
        let layout_path = relationships
            .values()
            .find(|relationship| {
                relationship.kind.ends_with("/slideLayout") && !relationship.external
            })
            .map(|relationship| relationship.target.clone());
        let layout = layout_path
            .as_deref()
            .map(|path| self.parse_layout(path))
            .transpose()?;
        let layout_placeholders = layout
            .as_ref()
            .map(|layout| layout.placeholders.clone())
            .unwrap_or_default();
        let master_path = layout
            .as_ref()
            .and_then(|layout| layout.master_path.clone())
            .or_else(|| self.first_relationship_kind(path, "/slideMaster"));
        let master_placeholders = master_path
            .as_deref()
            .and_then(|path| self.parse_master(path).ok())
            .map(|master| master.placeholders)
            .unwrap_or_else(|| self.master_placeholders.clone());
        let c_sld = root
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "cSld");
        let slide_background = c_sld.and_then(|node| self.parse_background(node, &self.color_map));
        let background = slide_background
            .or_else(|| layout.as_ref().and_then(|layout| layout.background))
            .or(self.master_background)
            .unwrap_or(Color::WHITE);
        let mut placeholders = layout_placeholders;

        placeholders.extend(master_placeholders);

        let shape_start = self.deck.shapes.len() as u32;
        let master_styles = self.master_styles;

        if let Some(tree) = c_sld.and_then(|node| child(node, "spTree")) {
            self.parse_shapes(
                tree,
                Transform::IDENTITY,
                &relationships,
                &placeholders,
                &master_styles,
            )?;
        }

        self.deck.slides.push(Slide {
            background,
            shape_start,
            shape_count: self.deck.shapes.len() as u32 - shape_start,
        });

        Ok(())
    }

    fn parse_background(&self, c_sld: Node, color_map: &ColorMap) -> Option<Color> {
        let bg = child(c_sld, "bg")?;

        if let Some(bg_pr) = child(bg, "bgPr") {
            return parse_fill_children(bg_pr, &self.theme, color_map);
        }

        if let Some(bg_ref) = child(bg, "bgRef") {
            return bg_ref
                .children()
                .find(|node| node.is_element())
                .and_then(|node| parse_color_node(node, &self.theme, color_map));
        }

        None
    }

    fn parse_shapes(
        &mut self,
        container: Node,
        transform: Transform,
        relationships: &HashMap<String, Relationship>,
        placeholders: &[PlaceholderInfo],
        master_styles: &MasterStyles,
    ) -> Result<()> {
        for node in container.children().filter(|node| node.is_element()) {
            if self.deck.shapes.len() >= MAX_SHAPES {
                return Err(ConvertError::TooManyShapes);
            }

            match node.tag_name().name() {
                "sp" => self.parse_sp(node, transform, placeholders, master_styles)?,
                "pic" => {
                    self.parse_pic(node, transform, relationships, placeholders, master_styles)?
                }
                "graphicFrame" => {
                    self.parse_graphic_frame(node, transform, placeholders, master_styles)?
                }
                "grpSp" => {
                    self.parse_group(node, transform, relationships, placeholders, master_styles)?
                }
                "cxnSp" => self.parse_connector(node, transform)?,
                "AlternateContent" => {
                    let before = self.deck.shapes.len();

                    if let Some(choice) = node
                        .children()
                        .find(|child| child.is_element() && child.tag_name().name() == "Choice")
                    {
                        self.parse_shapes(
                            choice,
                            transform,
                            relationships,
                            placeholders,
                            master_styles,
                        )?;
                    }

                    if self.deck.shapes.len() == before {
                        if let Some(fallback) = node.children().find(|child| {
                            child.is_element() && child.tag_name().name() == "Fallback"
                        }) {
                            self.parse_shapes(
                                fallback,
                                transform,
                                relationships,
                                placeholders,
                                master_styles,
                            )?;
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }

    fn parse_sp(
        &mut self,
        node: Node,
        transform: Transform,
        placeholders: &[PlaceholderInfo],
        master_styles: &MasterStyles,
    ) -> Result<()> {
        let sp_pr = child(node, "spPr");
        let ph = descendant(node, "ph");
        let kind = match ph {
            Some(node) => attribute(node, "type").unwrap_or("body").to_string(),
            None => "other".to_string(),
        };
        let idx = ph
            .and_then(|node| attribute(node, "idx"))
            .and_then(|value| value.parse::<u32>().ok());
        let matches: Vec<&PlaceholderInfo> = placeholders
            .iter()
            .filter(|placeholder| {
                if let Some(idx) = idx {
                    placeholder.idx == Some(idx)
                } else {
                    placeholder.kind == kind
                }
            })
            .collect();
        let (x, y, width, height, rotation) = sp_pr
            .and_then(|node| parse_rect_rotation(node, transform))
            .or_else(|| {
                matches
                    .iter()
                    .find_map(|placeholder| placeholder.rect)
                    .map(|rect| {
                        let rect = transform.map(rect);
                        (
                            rect.x / 12_700.0,
                            rect.y / 12_700.0,
                            rect.width / 12_700.0,
                            rect.height / 12_700.0,
                            0.0,
                        )
                    })
            })
            .unwrap_or((0.0, 0.0, 0.0, 0.0, 0.0));

        if width <= 0.0 || height <= 0.0 {
            return Ok(());
        }

        let mut styles = master_styles.for_kind(&kind);

        for placeholder in matches.iter().rev() {
            for (style, override_style) in styles.iter_mut().zip(placeholder.styles.iter()) {
                *style = style.merge(*override_style);
            }
        }

        let insets = matches
            .iter()
            .find_map(|placeholder| placeholder.insets)
            .unwrap_or_default();
        let anchor = matches
            .iter()
            .find_map(|placeholder| placeholder.anchor)
            .unwrap_or(Anchor::Top);
        let geometry = sp_pr
            .and_then(|node| child(node, "prstGeom"))
            .and_then(|node| attribute(node, "prst"))
            .map(geometry)
            .unwrap_or(Geometry::Rect);
        let fill = match sp_pr.and_then(|node| {
            node.children().find(|child| {
                child.is_element()
                    && matches!(child.tag_name().name(), "solidFill" | "gradFill" | "noFill")
            })
        }) {
            Some(fill) => parse_fill_element(fill, &self.theme, &self.color_map),
            None => style_fill(node, &self.theme, &self.color_map),
        };
        let line = match sp_pr.and_then(|node| child(node, "ln")) {
            Some(line) => parse_line(line, &self.theme, &self.color_map),
            None => style_line(node, &self.theme, &self.color_map),
        };
        let text = node
            .children()
            .find(|child| child.is_element() && child.tag_name().name() == "txBody")
            .map(|body| {
                parse_text_body(
                    &mut self.deck,
                    body,
                    &styles,
                    insets,
                    anchor,
                    &self.theme,
                    &self.color_map,
                )
            })
            .transpose()?
            .flatten();

        self.deck.shapes.push(Shape {
            x,
            y,
            width,
            height,
            rotation,
            geometry,
            fill,
            line,
            text,
            image: None,
            image_crop: None,
            table: None,
        });

        Ok(())
    }

    fn parse_pic(
        &mut self,
        node: Node,
        transform: Transform,
        relationships: &HashMap<String, Relationship>,
        _placeholders: &[PlaceholderInfo],
        _master_styles: &MasterStyles,
    ) -> Result<()> {
        let Some((x, y, width, height, rotation)) =
            child(node, "spPr").and_then(|node| parse_rect_rotation(node, transform))
        else {
            return Ok(());
        };
        let blip = descendant(node, "blip");
        let image = blip
            .and_then(|node| attribute(node, "embed"))
            .and_then(|id| relationships.get(id))
            .filter(|relationship| !relationship.external)
            .map(|relationship| self.add_media(&relationship.target))
            .transpose()?
            .flatten();

        if image.is_none() {
            return Ok(());
        }

        let crop = descendant(node, "srcRect").map(|node| {
            [
                crop_value(attribute(node, "l")),
                crop_value(attribute(node, "t")),
                crop_value(attribute(node, "r")),
                crop_value(attribute(node, "b")),
            ]
        });

        self.deck.shapes.push(Shape {
            x,
            y,
            width,
            height,
            rotation,
            geometry: Geometry::Rect,
            fill: None,
            line: child(node, "spPr")
                .and_then(|node| child(node, "ln"))
                .and_then(|node| parse_line(node, &self.theme, &self.color_map)),
            text: None,
            image,
            image_crop: crop,
            table: None,
        });

        Ok(())
    }

    fn parse_graphic_frame(
        &mut self,
        node: Node,
        transform: Transform,
        placeholders: &[PlaceholderInfo],
        master_styles: &MasterStyles,
    ) -> Result<()> {
        let Some((x, y, width, height, rotation)) =
            child(node, "xfrm").and_then(|node| parse_rect_rotation(node, transform))
        else {
            return Ok(());
        };
        let Some(table_node) = descendant(node, "tbl") else {
            return Ok(());
        };
        let Some(table) = self.parse_table(table_node, width, height, master_styles)? else {
            return Ok(());
        };

        self.deck.shapes.push(Shape {
            x,
            y,
            width,
            height,
            rotation,
            geometry: Geometry::Rect,
            fill: None,
            line: None,
            text: None,
            image: None,
            image_crop: None,
            table: Some(table),
        });

        let _ = placeholders;

        Ok(())
    }

    fn parse_table(
        &mut self,
        node: Node,
        width: f32,
        height: f32,
        master_styles: &MasterStyles,
    ) -> Result<Option<u32>> {
        let columns: Vec<f32> = child(node, "tblGrid")
            .map(|grid| {
                children(grid, "gridCol")
                    .filter_map(|column| emu(attribute(column, "w")))
                    .collect()
            })
            .unwrap_or_default();
        let rows: Vec<f32> = children(node, "tr")
            .filter_map(|row| emu(attribute(row, "h")))
            .collect();

        if columns.is_empty() || rows.is_empty() {
            return Ok(None);
        }

        let column_widths = if columns.len() == 1 && width > 0.0 {
            vec![width]
        } else {
            columns
        };
        let row_heights = if rows.len() == 1 && height > 0.0 {
            vec![height]
        } else {
            rows
        };
        let table_index = self.deck.tables.len() as u32;
        let cell_start = self.deck.cells.len() as u32;
        let styles = master_styles.other;
        let mut row_index = 0u32;

        for row in children(node, "tr") {
            let mut column_index = 0u32;

            for cell in children(row, "tc") {
                let column_span = attribute(cell, "gridSpan")
                    .and_then(|value| value.parse::<u32>().ok())
                    .unwrap_or(1)
                    .max(1);
                let row_span = attribute(cell, "rowSpan")
                    .and_then(|value| value.parse::<u32>().ok())
                    .unwrap_or(1)
                    .max(1);
                let merged = attribute(cell, "hMerge") == Some("1")
                    || attribute(cell, "vMerge") == Some("1");

                if self.deck.cells.len() >= MAX_TABLE_CELLS {
                    return Err(ConvertError::TooManyTableCells);
                }

                if !merged {
                    let properties = child(cell, "tcPr");
                    let fill = properties
                        .and_then(|node| parse_fill_children(node, &self.theme, &self.color_map));
                    let borders = [
                        properties.and_then(|node| child(node, "lnL")),
                        properties.and_then(|node| child(node, "lnR")),
                        properties.and_then(|node| child(node, "lnT")),
                        properties.and_then(|node| child(node, "lnB")),
                    ]
                    .map(|line| {
                        line.and_then(|line| parse_line(line, &self.theme, &self.color_map))
                    });
                    let text = child(cell, "txBody")
                        .map(|body| {
                            parse_text_body(
                                &mut self.deck,
                                body,
                                &styles,
                                Insets::default(),
                                Anchor::Top,
                                &self.theme,
                                &self.color_map,
                            )
                        })
                        .transpose()?
                        .flatten();

                    self.deck.cells.push(Cell {
                        row: row_index,
                        column: column_index,
                        row_span,
                        column_span,
                        fill,
                        borders,
                        text,
                    });
                }

                column_index += column_span;
            }

            row_index += 1;
        }

        self.deck.tables.push(Table {
            cell_start,
            cell_count: self.deck.cells.len() as u32 - cell_start,
            column_widths,
            row_heights,
        });

        Ok(Some(table_index))
    }

    fn parse_connector(&mut self, node: Node, transform: Transform) -> Result<()> {
        let Some((x, y, width, height, rotation)) =
            child(node, "spPr").and_then(|node| parse_rect_rotation(node, transform))
        else {
            return Ok(());
        };

        self.deck.shapes.push(Shape {
            x,
            y,
            width,
            height,
            rotation,
            geometry: Geometry::Line,
            fill: None,
            line: child(node, "spPr")
                .and_then(|node| child(node, "ln"))
                .and_then(|node| parse_line(node, &self.theme, &self.color_map))
                .or_else(|| {
                    Some(LineStyle {
                        color: Color::BLACK,
                        width: 1.0,
                        dash: None,
                        arrow_head: false,
                        arrow_tail: false,
                    })
                }),
            text: None,
            image: None,
            image_crop: None,
            table: None,
        });

        Ok(())
    }

    fn parse_group(
        &mut self,
        node: Node,
        transform: Transform,
        relationships: &HashMap<String, Relationship>,
        placeholders: &[PlaceholderInfo],
        master_styles: &MasterStyles,
    ) -> Result<()> {
        let group_transform = child(node, "grpSpPr")
            .and_then(|node| child(node, "xfrm"))
            .and_then(|node| {
                let off = child(node, "off")?;
                let ext = child(node, "ext")?;
                let ch_off = child(node, "chOff")?;
                let ch_ext = child(node, "chExt")?;
                let x = attribute(off, "x")?.parse::<f32>().ok()?;
                let y = attribute(off, "y")?.parse::<f32>().ok()?;
                let width = attribute(ext, "cx")?.parse::<f32>().ok()?;
                let height = attribute(ext, "cy")?.parse::<f32>().ok()?;
                let child_x = attribute(ch_off, "x")?.parse::<f32>().ok()?;
                let child_y = attribute(ch_off, "y")?.parse::<f32>().ok()?;
                let child_width = attribute(ch_ext, "cx")?.parse::<f32>().ok()?;
                let child_height = attribute(ch_ext, "cy")?.parse::<f32>().ok()?;

                if child_width == 0.0 || child_height == 0.0 {
                    return None;
                }

                Some(Transform {
                    sx: width / child_width,
                    sy: height / child_height,
                    tx: x - child_x * width / child_width,
                    ty: y - child_y * height / child_height,
                })
            })
            .unwrap_or(Transform::IDENTITY);

        self.parse_shapes(
            node,
            transform.compose(group_transform),
            relationships,
            placeholders,
            master_styles,
        )
    }

    fn add_media(&mut self, path: &str) -> Result<Option<u32>> {
        if let Some(index) = self.media_cache.get(path) {
            return Ok(Some(*index));
        }

        let bytes = self.package.read(path)?;
        let format = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            ImageFormat::Png
        } else if bytes.starts_with(b"\xFF\xD8") {
            ImageFormat::Jpeg
        } else {
            return Ok(None);
        };

        let (width, height) = crate::image::dimensions(&bytes, format)?;

        if u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
            return Err(ConvertError::ImageTooLarge);
        }

        if self.deck.media_spans.len() >= MAX_IMAGES {
            return Err(ConvertError::TooManyImages);
        }

        let start = self.deck.media.len() as u32;
        let len = bytes.len() as u32;

        self.deck.media.extend_from_slice(&bytes);
        self.deck.media_spans.push(MediaSpan { start, len, format });

        let index = self.deck.media_spans.len() as u32 - 1;

        self.media_cache.insert(path.to_string(), index);

        Ok(Some(index))
    }
}

fn parse_rect_rotation(node: Node, transform: Transform) -> Option<(f32, f32, f32, f32, f32)> {
    let xfrm = if node.tag_name().name() == "xfrm" {
        node
    } else {
        child(node, "xfrm")?
    };
    let rect = parse_rect(xfrm, transform)?;
    let rotation = attribute(xfrm, "rot")
        .and_then(|value| value.parse::<f32>().ok())
        .map(|value| value / 60_000.0)
        .unwrap_or(0.0);

    Some((
        rect.x / 12_700.0,
        rect.y / 12_700.0,
        rect.width / 12_700.0,
        rect.height / 12_700.0,
        rotation,
    ))
}

fn parse_rect(node: Node, transform: Transform) -> Option<Rect> {
    let xfrm = if node.tag_name().name() == "xfrm" {
        node
    } else {
        child(node, "xfrm")?
    };
    let off = child(xfrm, "off")?;
    let ext = child(xfrm, "ext")?;
    let rect = Rect {
        x: attribute(off, "x")?.parse::<f32>().ok()?,
        y: attribute(off, "y")?.parse::<f32>().ok()?,
        width: attribute(ext, "cx")?.parse::<f32>().ok()?,
        height: attribute(ext, "cy")?.parse::<f32>().ok()?,
    };

    Some(transform.map(rect))
}

fn geometry(preset: &str) -> Geometry {
    match preset {
        "roundRect" => Geometry::RoundRect,
        "ellipse" => Geometry::Ellipse,
        "line" | "straightConnector1" => Geometry::Line,
        "triangle" | "rtTriangle" => Geometry::Triangle,
        "diamond" => Geometry::Diamond,
        "parallelogram" => Geometry::Parallelogram,
        "trapezoid" => Geometry::Trapezoid,
        "hexagon" => Geometry::Hexagon,
        "chevron" => Geometry::Chevron,
        "rightArrow" => Geometry::RightArrow,
        "leftArrow" => Geometry::LeftArrow,
        "upArrow" => Geometry::UpArrow,
        "downArrow" => Geometry::DownArrow,
        "star5" => Geometry::Star,
        _ => Geometry::Rect,
    }
}

fn parse_line(node: Node, theme: &Theme, color_map: &ColorMap) -> Option<LineStyle> {
    if child(node, "noFill").is_some() {
        return None;
    }

    let width = emu(attribute(node, "w")).unwrap_or(1.0).max(0.25);
    let color = parse_fill_children(node, theme, color_map)?;
    let dash = child(node, "prstDash")
        .and_then(|node| attribute(node, "val"))
        .and_then(|value| match value {
            "dash" => Some(&[4.0, 3.0][..]),
            "sysDash" => Some(&[3.0, 2.0][..]),
            "dot" | "sysDot" => Some(&[1.0, 2.0][..]),
            "dashDot" => Some(&[4.0, 2.0, 1.0, 2.0][..]),
            _ => None,
        });
    let arrow_head = child(node, "headEnd")
        .and_then(|node| attribute(node, "type"))
        .is_some_and(|value| value != "none");
    let arrow_tail = child(node, "tailEnd")
        .and_then(|node| attribute(node, "type"))
        .is_some_and(|value| value != "none");

    Some(LineStyle {
        color,
        width,
        dash,
        arrow_head,
        arrow_tail,
    })
}

fn style_fill(node: Node, theme: &Theme, color_map: &ColorMap) -> Option<Color> {
    let reference = child(node, "style").and_then(|node| child(node, "fillRef"))?;

    if attribute(reference, "idx") == Some("0") {
        return None;
    }

    reference
        .children()
        .find(|node| node.is_element())
        .and_then(|node| parse_color_node(node, theme, color_map))
}

fn style_line(node: Node, theme: &Theme, color_map: &ColorMap) -> Option<LineStyle> {
    let reference = child(node, "style").and_then(|node| child(node, "lnRef"))?;

    if attribute(reference, "idx") == Some("0") {
        return None;
    }

    let color = reference
        .children()
        .find(|node| node.is_element())
        .and_then(|node| parse_color_node(node, theme, color_map))
        .unwrap_or(Color::BLACK);

    Some(LineStyle {
        color,
        width: 1.0,
        dash: None,
        arrow_head: false,
        arrow_tail: false,
    })
}

fn crop_value(value: Option<&str>) -> f32 {
    value
        .and_then(|value| value.parse::<f32>().ok())
        .map(|value| (value / 100_000.0).clamp(0.0, 0.95))
        .unwrap_or(0.0)
}
