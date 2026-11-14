import type { RasterPage } from "./pdf-build.ts";
import { runPdfJob } from "./pdf-worker-client.ts";
import { loadPdfjs, openPdf } from "./pdfjs.ts";
import type { OutputOptions, WatermarkStyle } from "./types.ts";
import { canvasToBytes, drawWatermarkOnCanvas } from "./watermark-canvas.ts";

export interface ProcessSettings {
  lines: string[];
  style: WatermarkStyle;
  output: OutputOptions;
}

/** Au-delà, Safari refuse d'allouer le canvas (limite ≈ 16,7 Mpx). */
const MAX_CANVAS_AREA = 16_000_000;
const JPEG_QUALITY = 0.88;
/** Part de la progression consacrée au rendu des pages (le reste : assemblage). */
const RENDER_SHARE = 0.85;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Traitement annulé", "AbortError");
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function rasterize(
  source: Uint8Array,
  settings: ProcessSettings,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<RasterPage[]> {
  const pdfjs = await loadPdfjs();
  const { pdf, close } = await openPdf(source);
  const pages: RasterPage[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      throwIfAborted(signal);
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      let scale = settings.output.dpi / 72;
      const area = base.width * base.height * scale * scale;
      if (area > MAX_CANVAS_AREA) scale = Math.sqrt(MAX_CANVAS_AREA / (base.width * base.height));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({
        canvas,
        viewport,
        intent: "print",
        annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE,
        background: "#ffffff",
      }).promise;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible.");
      drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
        lines: settings.lines,
        style: settings.style,
        pageWidthPt: base.width,
        pageHeightPt: base.height,
      });
      const image = await canvasToBytes(canvas, "image/jpeg", JPEG_QUALITY);
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      pages.push({
        image,
        imageFormat: "jpeg",
        pageWidth: base.width,
        pageHeight: base.height,
        x: 0,
        y: 0,
        width: base.width,
        height: base.height,
      });
      onProgress(n / pdf.numPages);
      await yieldToUi();
    }
  } finally {
    close();
  }
  return pages;
}

/**
 * Applique le filigrane à un document.
 * - aplati : chaque page devient une image (pdf.js + canvas) avec le filigrane incrusté ;
 * - vectoriel : le filigrane est ajouté en texte par-dessus le contenu d'origine.
 */
export async function processDocument(
  source: Uint8Array,
  settings: ProcessSettings,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const { output } = settings;
  if (output.flatten) {
    const pages = await rasterize(source, settings, (f) => onProgress(f * RENDER_SHARE), signal);
    throwIfAborted(signal);
    return runPdfJob({ kind: "raster", pages, password: output.password, stripMetadata: true }, (done, total) =>
      onProgress(RENDER_SHARE + (1 - RENDER_SHARE) * (done / total)),
    );
  }
  throwIfAborted(signal);
  return runPdfJob(
    { kind: "vector", source: source.slice(), lines: settings.lines, style: settings.style, password: output.password },
    (done, total) => onProgress(done / total),
  );
}
