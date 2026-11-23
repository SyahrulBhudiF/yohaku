use std::env;
use std::fs;
use std::time::Instant;

use xlsx_pdf_core::convert;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() != 4 {
        eprintln!("usage: convert <input.xlsx> <output.pdf> <a4|letter>");
        std::process::exit(1);
    }

    let input = fs::read(&args[1]).expect("read input");
    let start = Instant::now();
    let output = convert(&input, &args[3], "landscape").expect("convert");
    let elapsed = start.elapsed();

    fs::write(&args[2], &output).expect("write output");
    println!(
        "{} bytes -> {} bytes in {:.2} ms",
        input.len(),
        output.len(),
        elapsed.as_secs_f64() * 1000.0
    );
}
