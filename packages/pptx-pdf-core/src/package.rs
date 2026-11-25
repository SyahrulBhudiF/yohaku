use std::collections::HashMap;
use std::io::{Cursor, Read};

use roxmltree::Document;
use zip::ZipArchive;

use crate::error::{ConvertError, Result};
use crate::limits::{MAX_PART_BYTES, MAX_UNCOMPRESSED_BYTES};

#[derive(Clone, Debug)]
pub struct Relationship {
    pub target: String,
    pub kind: String,
    pub external: bool,
}

pub struct Package<'a> {
    archive: ZipArchive<Cursor<&'a [u8]>>,
    read_bytes: usize,
}

impl<'a> Package<'a> {
    pub fn new(bytes: &'a [u8]) -> Result<Self> {
        if bytes.len() < 4 || &bytes[..2] != b"PK" {
            return Err(ConvertError::InvalidPresentation);
        }

        let archive = ZipArchive::new(Cursor::new(bytes)).map_err(|error| match error {
            zip::result::ZipError::UnsupportedArchive(message)
                if message.to_ascii_lowercase().contains("password") =>
            {
                ConvertError::EncryptedPresentation
            }
            _ => ConvertError::InvalidPresentation,
        })?;

        let mut package = Self {
            archive,
            read_bytes: 0,
        };

        if !package.exists("ppt/presentation.xml") {
            return Err(ConvertError::InvalidPresentation);
        }

        Ok(package)
    }

    pub fn exists(&mut self, name: &str) -> bool {
        self.archive.by_name(name).is_ok()
    }

    pub fn read(&mut self, name: &str) -> Result<Vec<u8>> {
        let mut entry = self.archive.by_name(name).map_err(|error| match error {
            zip::result::ZipError::UnsupportedArchive(message)
                if message.to_ascii_lowercase().contains("password") =>
            {
                ConvertError::EncryptedPresentation
            }
            _ => ConvertError::InvalidPresentation,
        })?;

        if entry.is_dir() {
            return Err(ConvertError::InvalidPresentation);
        }

        let size = entry.size();

        if size > MAX_PART_BYTES as u64 {
            return Err(ConvertError::PartTooLarge);
        }

        self.read_bytes = self.read_bytes.saturating_add(size as usize);

        if self.read_bytes > MAX_UNCOMPRESSED_BYTES {
            return Err(ConvertError::PresentationTooLarge);
        }

        let mut data = Vec::with_capacity(size as usize);

        entry
            .by_ref()
            .take(MAX_PART_BYTES as u64 + 1)
            .read_to_end(&mut data)
            .map_err(|_| ConvertError::InvalidPresentation)?;

        if data.len() > MAX_PART_BYTES {
            return Err(ConvertError::PartTooLarge);
        }

        Ok(data)
    }

    pub fn read_text(&mut self, name: &str) -> Result<String> {
        let bytes = self.read(name)?;
        let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(&bytes);

        String::from_utf8(bytes.to_vec()).map_err(|_| ConvertError::InvalidPresentation)
    }

    pub fn read_xml(&mut self, name: &str) -> Result<String> {
        self.read_text(name)
    }

    pub fn relationships(&mut self, part: &str) -> Result<HashMap<String, Relationship>> {
        let path = relationship_path(part);

        if !self.exists(&path) {
            return Ok(HashMap::new());
        }

        let xml = self.read_xml(&path)?;
        let document = Document::parse(&xml).map_err(|_| ConvertError::InvalidPresentation)?;
        let mut relationships = HashMap::new();

        for node in document
            .descendants()
            .filter(|node| node.is_element() && node.tag_name().name() == "Relationship")
        {
            let Some(id) = attribute(node, "Id") else {
                continue;
            };
            let Some(target) = attribute(node, "Target") else {
                continue;
            };

            relationships.insert(
                id.to_string(),
                Relationship {
                    target: resolve_target(part, target),
                    kind: attribute(node, "Type").unwrap_or_default().to_string(),
                    external: attribute(node, "TargetMode") == Some("External"),
                },
            );
        }

        Ok(relationships)
    }

    pub fn office_document(&mut self) -> Result<String> {
        let relationships = self.relationships("")?;

        if let Some(relationship) = relationships
            .values()
            .find(|relationship| relationship.kind.ends_with("/officeDocument"))
        {
            if !relationship.external {
                return Ok(relationship.target.clone());
            }
        }

        Ok("ppt/presentation.xml".to_string())
    }
}

pub fn relationship_path(part: &str) -> String {
    if part.is_empty() {
        return "_rels/.rels".to_string();
    }

    let (directory, name) = part.rsplit_once('/').unwrap_or(("", part));

    if directory.is_empty() {
        format!("_rels/{name}.rels")
    } else {
        format!("{directory}/_rels/{name}.rels")
    }
}

pub fn resolve_target(base_part: &str, target: &str) -> String {
    let target = percent_decode(target.replace('\\', "/"));

    if let Some(absolute) = target.strip_prefix('/') {
        return absolute.to_string();
    }

    let directory = base_part.rsplit_once('/').map(|(dir, _)| dir).unwrap_or("");
    let mut parts: Vec<&str> = directory
        .split('/')
        .filter(|part| !part.is_empty())
        .collect();

    for part in target.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }

    parts.join("/")
}

fn percent_decode(value: String) -> String {
    if !value.contains('%') {
        return value;
    }

    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex(bytes[index + 1]), hex(bytes[index + 2])) {
                output.push(high * 16 + low);
                index += 3;

                continue;
            }
        }

        output.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&output).into_owned()
}

fn hex(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

pub fn attribute<'a, 'input>(node: roxmltree::Node<'a, 'input>, name: &str) -> Option<&'a str> {
    node.attributes()
        .find(|attribute| attribute.name() == name)
        .map(|attribute| attribute.value())
}

pub fn relationship_id<'a, 'input>(node: roxmltree::Node<'a, 'input>) -> Option<&'a str> {
    node.attributes()
        .find(|attribute| {
            attribute.name() == "id"
                && attribute
                    .namespace()
                    .is_some_and(|namespace| namespace.ends_with("/relationships"))
        })
        .map(|attribute| attribute.value())
}

pub fn child<'a, 'input>(
    node: roxmltree::Node<'a, 'input>,
    name: &str,
) -> Option<roxmltree::Node<'a, 'input>> {
    node.children()
        .find(|child| child.is_element() && child.tag_name().name() == name)
}

pub fn children<'a, 'input>(
    node: roxmltree::Node<'a, 'input>,
    name: &'static str,
) -> impl Iterator<Item = roxmltree::Node<'a, 'input>> {
    node.children()
        .filter(move |child| child.is_element() && child.tag_name().name() == name)
}

pub fn descendant<'a, 'input>(
    node: roxmltree::Node<'a, 'input>,
    name: &str,
) -> Option<roxmltree::Node<'a, 'input>> {
    node.descendants()
        .find(|descendant| descendant.is_element() && descendant.tag_name().name() == name)
}
