use std::fs;

fn main() {
    let arguments: Vec<String> = std::env::args().collect();
    let input = arguments.get(1).expect("input .pptx");
    let output = arguments.get(2).expect("output .pdf");
    let bytes = fs::read(input).expect("read input");
    let pdf = pptx_pdf_core::convert(&bytes).expect("convert");

    fs::write(output, pdf).expect("write output");
}
