#[derive(Clone, Copy, Default)]
pub(crate) struct Span {
    pub offset: u32,
    pub len: u32,
}

pub(crate) struct TextArena {
    bytes: Vec<u8>,
}

impl TextArena {
    pub fn new() -> Self {
        Self { bytes: Vec::new() }
    }

    pub fn push(&mut self, text: &str) -> Span {
        let offset = self.bytes.len() as u32;

        self.bytes.extend_from_slice(text.as_bytes());

        Span {
            offset,
            len: text.len() as u32,
        }
    }

    pub fn get(&self, span: Span) -> &str {
        if span.len == 0 {
            return "";
        }

        let start = span.offset as usize;
        let end = start + span.len as usize;

        std::str::from_utf8(&self.bytes[start..end]).unwrap_or("")
    }
}

pub(crate) struct SheetData {
    pub name: String,
    pub arena: TextArena,
    // Row-major spans: row * cols + column.
    pub cells: Vec<Span>,
    pub row_count: usize,
    pub cols: usize,
    pub has_header: bool,
    // Maximum display width per column, capped at 32 characters.
    pub widths: Vec<u16>,
}

impl SheetData {
    pub fn data_start(&self) -> usize {
        if self.has_header {
            1
        } else {
            0
        }
    }

    pub fn data_rows(&self) -> usize {
        self.row_count.saturating_sub(self.data_start())
    }

    pub fn cell(&self, row: usize, column: usize) -> &str {
        self.arena.get(self.cells[row * self.cols + column])
    }
}

pub(crate) struct PageFormat {
    pub width: f32,
    pub height: f32,
}
