import type { ToolDefinition } from "./registry"

type ToolPath = NonNullable<ToolDefinition["to"]>

const CONTENT: Record<
  ToolPath,
  { title: string; description: string; guide: string; related: readonly ToolPath[] }
> = {
  "/image/convert": {
    title: "Image Converter Online — JPG, PNG, WebP & More",
    description:
      "Convert images between JPG, PNG, WebP, AVIF, GIF and TIFF, or trace an image to SVG. Files stay in your browser.",
    guide:
      "Choose an image, select the output format and download the converted file. Use JPG for photos, PNG when you need transparency, or WebP for web delivery. The SVG option traces shapes and works best with simple artwork.",
    related: ["/image/compress", "/image/resize"],
  },
  "/image/compress": {
    title: "Compress Images Online — JPG, PNG & WebP",
    description:
      "Reduce JPG, PNG, WebP, AVIF, GIF or TIFF file size in your browser. Adjust compression, compare before and after sizes, and download without uploading.",
    guide:
      "Choose an image and keep its original format or pick a new one. Lower the quality for a smaller JPG or WebP, then compare the result with the original. PNG compression is lossless, so an already optimized PNG may not shrink further.",
    related: ["/image/batch-compress", "/image/resize"],
  },
  "/image/batch-compress": {
    title: "Batch Image Compressor — Compress Multiple Images",
    description:
      "Compress up to 50 images at once. Apply the same settings to JPG, PNG, WebP and other supported images, then download the results as a ZIP.",
    guide:
      "Select up to 50 pictures and choose one set of compression settings for the batch. Review the file sizes and download the successful results together. For different settings per photo, use the single-image compressor.",
    related: ["/image/compress", "/image/convert"],
  },
  "/image/resize": {
    title: "Resize and Crop Images Online — Change Pixel Dimensions",
    description:
      "Resize images by pixel dimensions, crop with a preview, or rotate and flip a photo. Edit and download the result in your browser.",
    guide:
      "Open an image and set its width and height. Use the crop controls to frame a portion of the picture, or rotate and flip it before export. Resizing changes pixel dimensions; use image compression when you need a smaller file at the same dimensions.",
    related: ["/image/compress", "/image/convert"],
  },
  "/image/to-pdf": {
    title: "Image to PDF Converter — Combine JPG and PNG Files",
    description:
      "Turn JPG, PNG and other images into a single PDF, or make a separate PDF per image. Reorder pictures before exporting.",
    guide:
      "Add your photos or scans and drag them into the order you want. Choose one combined PDF for a multipage document, or export each picture as its own PDF. The conversion does not make text in a scan selectable.",
    related: ["/pdf/merge", "/pdf/to-image"],
  },
  "/image/remove-background": {
    title: "Remove Image Background — Make a Transparent PNG",
    description:
      "Remove a plain or solid-color image background and save a transparent PNG. This browser tool works without an upload or AI model.",
    guide:
      "Choose a photo or graphic with a mostly uniform background and a clearly separated subject. Run background removal and inspect the PNG preview. Busy scenes and backgrounds with colors close to the subject are harder to separate.",
    related: ["/image/resize", "/image/convert"],
  },
  "/pdf/merge": {
    title: "Merge PDF Online — Combine PDFs into One File",
    description:
      "Combine multiple PDF files into one document. Preview and drag pages into order before downloading the merged PDF.",
    guide:
      "Add the PDFs you want to combine, then drag the page thumbnails into the final order. Use this for combining reports or scans into one file. If bookmarks or interactive forms matter, keep the originals; they are not preserved by the merge.",
    related: ["/pdf/reorganize", "/pdf/compress"],
  },
  "/pdf/compress": {
    title: "Compress PDF Online — Reduce PDF File Size",
    description:
      "Optimize a PDF and compare the before and after file sizes. Lossless compression works in your browser without reducing image quality.",
    guide:
      "Choose a PDF and run the optimizer. It looks for ways to shrink the file without lowering image resolution or quality. Some PDFs are already optimized and may not get noticeably smaller.",
    related: ["/pdf/extract", "/pdf/split"],
  },
  "/pdf/extract": {
    title: "Extract PDF Pages — Save Selected Pages as a New PDF",
    description:
      "Select and extract pages from a PDF to create one smaller document. Keep just the pages you want without editing the original.",
    guide:
      "Open the PDF, choose the pages you want to keep and download them as one new PDF. Use Split PDF instead when you need several separate files for different page ranges.",
    related: ["/pdf/split", "/pdf/reorganize"],
  },
  "/pdf/split": {
    title: "Split PDF Online — Separate a PDF by Page Range",
    description:
      "Divide a PDF into smaller documents by selecting page ranges. Download multiple PDFs together in a ZIP file.",
    guide:
      "Open your PDF and set the groups of pages that belong in each output file. Download the results together when you split into multiple parts. If you want several selected pages in just one PDF, use Extract PDF pages.",
    related: ["/pdf/extract", "/pdf/merge"],
  },
  "/pdf/reorganize": {
    title: "Organize PDF Pages — Reorder, Rotate or Delete Pages",
    description:
      "Rearrange PDF pages by dragging thumbnails, rotate sideways pages, or remove unwanted pages before saving a new PDF.",
    guide:
      "Open a PDF to see the page thumbnails. Drag pages into reading order, rotate sideways scans and remove any pages you no longer need. Export a new copy so the original stays unchanged.",
    related: ["/pdf/extract", "/pdf/merge"],
  },
  "/pdf/protect": {
    title: "Protect or Unlock PDF — Add or Remove a PDF Password",
    description:
      "Add AES-256 password protection to a PDF or remove protection using the existing password. The file is processed in your browser.",
    guide:
      "Choose Protect to set a password before sharing the PDF, or Unlock to remove protection from a file you can already open. Unlocking requires the existing password; it does not recover forgotten passwords.",
    related: ["/pdf/compress", "/pdf/annotate"],
  },
  "/pdf/to-image": {
    title: "PDF to Image Converter — PDF to JPG or PNG",
    description:
      "Convert PDF pages to JPG, PNG, WebP, AVIF, GIF or TIFF. Pick pages and resolution, then download one image or a ZIP. No PDF upload required.",
    guide:
      "Open a PDF, select the pages and choose your image format. Use 72 DPI for smaller screen images or 300 DPI for more print detail. One page downloads as an image; multiple pages download in a ZIP. The tool renders full pages, not just the pictures embedded in them.",
    related: ["/image/compress", "/image/to-pdf"],
  },
  "/pdf/to-word": {
    title: "PDF to Word Converter — Extract Text to DOCX",
    description:
      "Convert selectable text in a PDF into an editable Word document. Works in your browser; scanned pages without text are not supported.",
    guide:
      "Open a PDF with selectable text and convert it to DOCX. Use this when you need editable copy rather than an exact reproduction of the page. Scanned PDFs need OCR first, and the original layout may not carry over.",
    related: ["/word/to-pdf", "/pdf/to-excel"],
  },
  "/pdf/to-excel": {
    title: "PDF to Excel Converter — Extract Text to XLSX",
    description:
      "Export selectable PDF text to an Excel workbook. Yohaku infers rows and columns from text positions; scanned documents need OCR first.",
    guide:
      "Select a text-based PDF and export it to XLSX. Check the resulting rows and columns before using them in calculations; columns are inferred from the PDF layout, and the converter does not reconstruct formulas.",
    related: ["/excel/to-pdf", "/pdf/to-word"],
  },
  "/pdf/sign": {
    title: "Sign PDF Online — Draw or Upload a Signature",
    description:
      "Draw a signature or import a signature image, then place it on PDF pages and download the signed document.",
    guide:
      "Open the PDF and draw a signature or choose a signature image. Position it on the page before saving. This adds a visible signature mark, not a certificate-backed digital signature.",
    related: ["/pdf/annotate", "/pdf/protect"],
  },
  "/pdf/annotate": {
    title: "Add Page Numbers or a Watermark to PDF Online",
    description:
      "Number PDF pages or stamp a text or logo watermark. Choose the position and page range and save a new copy.",
    guide:
      "Open an unlocked PDF, select page numbering or watermarking and choose the pages to stamp. Set the number position or adjust the watermark placement and opacity. Rewriting a PDF can invalidate existing digital signatures.",
    related: ["/pdf/reorganize", "/pdf/protect"],
  },
  "/excel/to-pdf": {
    title: "Excel to PDF Converter — Turn XLSX Sheets into PDFs",
    description:
      "Convert XLSX spreadsheets into printable PDF tables. Choose the paper size and orientation without uploading the workbook.",
    guide:
      "Select an XLSX workbook and choose the paper size and orientation. Landscape gives wide tables more room. This is a table export, not an exact replica of the spreadsheet: charts and merged-cell layout are not preserved.",
    related: ["/pdf/to-excel", "/pdf/merge"],
  },
  "/word/to-pdf": {
    title: "Word to PDF Converter — Convert DOCX to PDF",
    description:
      "Render a Word DOCX file as a PDF in your browser. Download a copy for reading, printing or sharing without uploading the document.",
    guide:
      "Choose a DOCX file, convert it and open the resulting PDF to check the pages before sharing. Save older DOC files as DOCX first; this tool does not convert the legacy DOC format.",
    related: ["/pdf/to-word", "/pdf/compress"],
  },
  "/markdown/to-word": {
    title: "Markdown to Word Converter — Convert MD to DOCX",
    description:
      "Convert Markdown text or a .md file to an editable Word DOCX document. Headings, emphasis, lists, links, quotes, code blocks and simple tables are supported; files stay in your browser.",
    guide:
      "Paste or type Markdown, or open an .md file. Convert it to DOCX and review the downloaded document. The converter supports common Markdown blocks; advanced extensions and exact page layout are not preserved.",
    related: ["/word/to-markdown", "/markdown/to-pdf"],
  },
  "/markdown/to-pdf": {
    title: "Markdown to PDF Converter — Convert MD to PDF",
    description:
      "Turn Markdown text or a .md file into a paginated, searchable PDF. Common headings, lists, emphasis, links, quotes, code blocks and simple tables are supported locally.",
    guide:
      "Paste or type Markdown, or open an .md file, then convert and download the PDF. The PDF is laid out for reading and printing; complex Markdown extensions and original web styling are not included.",
    related: ["/markdown/to-word", "/pdf/to-markdown"],
  },
  "/word/to-markdown": {
    title: "Word to Markdown Converter — Convert DOCX to MD",
    description:
      "Convert a Word DOCX document to Markdown. Extract text, heading levels, lists and simple tables in your browser without uploading the file.",
    guide:
      "Choose a DOCX file to extract its readable document text as Markdown. Text emphasis, heading levels, lists and tables are recognized. Images, page layout, and older .doc files are not supported.",
    related: ["/markdown/to-word", "/word/to-pdf"],
  },
  "/pdf/to-markdown": {
    title: "PDF to Markdown Converter — Extract PDF Text to MD",
    description:
      "Extract selectable text from PDF files and save it as Markdown with page breaks. Scanned PDFs need OCR first; processing stays in your browser.",
    guide:
      "Choose a text-based PDF and convert its pages to Markdown. Page breaks and approximate reading order are included. Scanned pages without selectable text require OCR, and complex layouts may be reordered.",
    related: ["/pdf/to-word", "/markdown/to-pdf"],
  },
  "/powerpoint/to-pdf": {
    title: "PowerPoint to PDF Converter — Convert PPTX Slides",
    description:
      "Turn PPTX slides into a PDF with one page per slide. Export supported text, shapes, images and tables in your browser.",
    guide:
      "Select a PPTX presentation and download the slide deck as a PDF. The output is static, so animations are not included. Save legacy PPT files as PPTX first, and review slides with complex graphics before sharing.",
    related: ["/pdf/to-image", "/pdf/compress"],
  },
  "/media/video-to-mp3": {
    title: "Video to MP3 Converter — Extract Audio from Video",
    description:
      "Turn the audio track of a local video into an MP3. Select a video file and download the audio without uploading the original.",
    guide:
      "Choose an MP4, MOV, WebM or another supported video with an audio track and convert it. The result is a 192 kbps MP3 with no video. Use the social downloader instead if you are starting with a supported public URL rather than a file.",
    related: ["/media/social-downloader"],
  },
  "/media/social-downloader": {
    title: "YouTube, Instagram & Facebook Video Downloader",
    description:
      "Download videos or extract audio from supported public YouTube, Instagram and Facebook links. Private or login-protected posts are not supported.",
    guide:
      "Paste a supported public video URL and choose an available download or audio option. Use this only for media you are allowed to download. For a video already saved on your device, use the local Video to MP3 converter.",
    related: ["/media/video-to-mp3"],
  },
}

export function toolSearchContent(path: ToolPath) {
  return CONTENT[path]
}
