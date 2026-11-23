use xlsx_pdf_core::convert;

fn fixture() -> Vec<u8> {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../tests/support/fixtures/excel-to-pdf.xlsx"
    );

    std::fs::read(path).expect("read fixture")
}

#[test]
fn converts_a_workbook() {
    let pdf = convert(&fixture(), "a4", "landscape").expect("convert");

    assert!(pdf.starts_with(b"%PDF-"));
    assert!(pdf.len() > 1_000);
}

#[test]
fn rejects_invalid_bytes() {
    assert!(convert(b"not a workbook", "a4", "landscape").is_err());
}

#[test]
fn supports_portrait() {
    let pdf = convert(&fixture(), "a4", "portrait").expect("convert");

    assert!(pdf.starts_with(b"%PDF-"));
}
