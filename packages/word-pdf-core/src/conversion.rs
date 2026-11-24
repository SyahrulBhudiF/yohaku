use jubarte_render::convert::docx_to_pdf;

pub fn convert(bytes: &[u8]) -> Result<Vec<u8>, String> {
    docx_to_pdf(bytes).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::convert;

    #[test]
    fn rejects_non_docx_input_with_a_readable_error() {
        let error = convert(b"not a Word document").expect_err("input is not an OPC package");

        assert!(error.contains("opening DOCX"));
    }
}
