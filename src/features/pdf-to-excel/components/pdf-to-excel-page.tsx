import { FileSpreadsheetIcon, TablePropertiesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PDF_BYTES } from "@/libs/schemas/pdf"
import { usePdfToExcel } from "../use-pdf-to-excel"

export function PdfToExcelPage() {
  const model = usePdfToExcel()
  const error = model.selectionError ?? model.convert.error?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="pdf-to-excel" japanese="PDFをExcelに変換">
        <h1 className="text-3xl font-normal tracking-tight">PDF to Excel</h1>
        <p className="text-muted-foreground">
          Turn selectable PDF text into an editable workbook. Each PDF page becomes a worksheet.
        </p>
      </ToolPageHeader>
      <FileDropzone
        accept="application/pdf,.pdf"
        file={model.file}
        icon={FileSpreadsheetIcon}
        helperText={`PDF only · up to ${MAX_PDF_BYTES / 1024 / 1024} MB`}
        onSelect={model.selectFile}
        onRemove={model.clear}
      />
      <p className="text-sm text-muted-foreground">
        Columns are inferred from text positions. This works best for simple tables; scanned PDFs
        need OCR and are not supported.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-error-container p-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}
      {model.file && !model.result && (
        <Button
          className="self-end"
          disabled={model.convert.isPending}
          onClick={() => model.convert.mutate(model.file!)}
          aria-busy={model.convert.isPending}
        >
          <TablePropertiesIcon />
          {model.convert.isPending ? "Converting PDF…" : "Convert to Excel"}
        </Button>
      )}
      {model.result && (
        <ConversionResult
          url={model.result.url}
          fileName={model.result.fileName}
          inputBytes={model.result.inputBytes}
          outputBytes={model.result.outputBytes}
          detail={`${model.result.pages} ${model.result.pages === 1 ? "worksheet" : "worksheets"}`}
        />
      )}
    </main>
  )
}
