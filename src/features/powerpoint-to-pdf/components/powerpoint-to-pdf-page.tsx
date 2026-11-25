import { FileDownIcon, Loader2Icon, PresentationIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/features/document-tools/components/file-dropzone"
import { ConversionResult } from "@/features/tools/components/conversion-result"
import { ToolPageHeader } from "@/features/tools/components/tool-page-header"
import { MAX_PPTX_BYTES, MAX_PPTX_SLIDES } from "@/libs/schemas/powerpoint"
import { usePowerPointToPdf } from "../use-powerpoint-to-pdf"

export function PowerPointToPdfPage() {
  const model = usePowerPointToPdf()
  const error = model.selectionError ?? model.convert.error?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ToolPageHeader id="powerpoint-to-pdf" japanese="PowerPointからPDFへ">
        <h1 className="text-3xl font-normal tracking-tight">PowerPoint to PDF</h1>
        <p className="text-muted-foreground">
          Render PPTX slides to PDF locally in your browser. Text, shapes, images, and tables keep
          their layout; your file is never uploaded.
        </p>
      </ToolPageHeader>

      <FileDropzone
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        file={model.file}
        icon={PresentationIcon}
        helperText={`PPTX only · up to ${MAX_PPTX_BYTES / 1024 / 1024} MB · ${MAX_PPTX_SLIDES} slides`}
        onSelect={model.selectFile}
        onRemove={model.clear}
      />

      <p className="text-sm text-muted-foreground">
        Rendering runs in a background worker. Standard fonts and WinAnsi text are used, so custom
        fonts and non-Latin text are substituted. Charts, SmartArt, animations, and legacy .ppt
        files are not rendered; save older decks as .pptx first.
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
          {model.convert.isPending ? <Loader2Icon className="animate-spin" /> : <FileDownIcon />}
          {model.convert.isPending ? "Rendering PDF…" : "Convert to PDF"}
        </Button>
      )}

      {model.result && (
        <ConversionResult
          url={model.result.url}
          fileName={model.result.fileName}
          inputBytes={model.result.inputBytes}
          outputBytes={model.result.outputBytes}
        >
          <Button
            variant="ghost"
            className="mt-1 self-start"
            onClick={model.clear}
            disabled={model.convert.isPending}
          >
            <Trash2Icon /> Convert another deck
          </Button>
        </ConversionResult>
      )}
    </main>
  )
}
