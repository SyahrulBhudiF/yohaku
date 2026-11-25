use std::io::{Cursor, Write};

use pptx_pdf_core::convert;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

fn png() -> Vec<u8> {
    let mut output = Vec::new();
    let mut encoder = png::Encoder::new(&mut output, 32, 24);

    encoder.set_color(png::ColorType::Rgb);
    encoder.set_depth(png::BitDepth::Eight);

    let mut writer = encoder.write_header().expect("png header");
    let data: Vec<u8> = (0..32 * 24)
        .flat_map(|index| {
            let x = index % 32;
            let y = index / 32;

            [x as u8 * 8, y as u8 * 10, 120]
        })
        .collect();

    writer.write_image_data(&data).expect("png data");
    drop(writer);

    output
}

fn presentation() -> Vec<u8> {
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default();

    let files: [(&str, String); 3] = [
        (
            "ppt/presentation.xml",
            r#"<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:defaultTextStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:defRPr></a:lvl1pPr></p:defaultTextStyle>
</p:presentation>"#
                .to_string(),
        ),
        (
            "ppt/_rels/presentation.xml.rels",
            r#"<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>"#
                .to_string(),
        ),
        (
            "ppt/slides/slide1.xml",
            r#"<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="914400" y="609600"/><a:ext cx="10058400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="E8E2D6"/></a:solidFill></p:spPr>
        <p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="4000" b="1"><a:solidFill><a:srgbClr val="1F2622"/></a:solidFill></a:rPr><a:t>Hello PPTX</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="914400" y="1828800"/><a:ext cx="5486400" cy="1828800"/></a:xfrm><a:prstGeom prst="rect"/><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:buChar char="•"/></a:pPr><a:r><a:rPr sz="2400"><a:solidFill><a:srgbClr val="2C342F"/></a:solidFill></a:rPr><a:t>Shapes and text</a:t></a:r></a:p><a:p><a:r><a:rPr sz="1800" i="1"><a:solidFill><a:srgbClr val="7A8F77"/></a:solidFill></a:rPr><a:t>Rendered locally</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="4" name="Image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="6400800" y="1828800"/><a:ext cx="3657600" cy="2743200"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr>
      </p:pic>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="5" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="914400" y="4572000"/><a:ext cx="5486400" cy="914400"/></p:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl>
            <a:tblGrid><a:gridCol w="2743200"/><a:gridCol w="2743200"/></a:tblGrid>
            <a:tr h="457200"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Area</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="1F2622"/></a:solidFill></a:tcPr></a:tc><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>Status</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="1F2622"/></a:solidFill></a:tcPr></a:tc></a:tr>
            <a:tr h="457200"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1300"/><a:t>Image</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="F0ECE3"/></a:solidFill></a:tcPr></a:tc><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1300"/><a:t>Shipped</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="F0ECE3"/></a:solidFill></a:tcPr></a:tc></a:tr>
          </a:tbl>
        </a:graphicData></a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
</p:sld>"#
                .to_string(),
        ),
    ];

    for (name, content) in files {
        zip.start_file(name, options).expect("start file");
        zip.write_all(content.as_bytes()).expect("write file");
    }

    zip.start_file("ppt/slides/_rels/slide1.xml.rels", options)
        .expect("start rels");
    zip.write_all(
        br#"<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>"#,
    )
    .expect("write rels");

    zip.start_file("ppt/media/image1.png", options)
        .expect("start image");
    zip.write_all(&png()).expect("write image");

    zip.finish().expect("finish zip").into_inner()
}

#[test]
fn converts_a_presentation_with_text_shapes_images_and_tables() {
    let pdf = convert(&presentation()).expect("convert");

    assert!(pdf.starts_with(b"%PDF"));
    assert!(pdf.len() > 2_000);
}

#[test]
fn rejects_files_that_are_not_presentation_packages() {
    let error = convert(b"not a presentation").expect_err("input is not a zip package");

    assert!(error.message().contains("readable"));
}
