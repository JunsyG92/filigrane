import { layoutWatermark } from "./layout.ts";
import type { WatermarkStyle } from "./types.ts";

export const CANVAS_FONT_FAMILY = "Helvetica, Arial, sans-serif";

export interface CanvasWatermarkParams {
  lines: readonly string[];
  style: WatermarkStyle;
  /** Dimensions de la page affichée, en points. */
  pageWidthPt: number;
  pageHeightPt: number;
}

/** Incruste la mosaïque sur un canvas contenant déjà le rendu de la page. */
export function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  { lines, style, pageWidthPt, pageHeightPt }: CanvasWatermarkParams,
): void {
  if (lines.length === 0) return;
  const scale = canvasWidth / pageWidthPt;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(scale, scale);
  // Canvas : y vers le bas. Tourner de -angle ici = tourner de +angle dans le repère PDF.
  ctx.rotate((-style.angle * Math.PI) / 180);
  ctx.font = `bold ${style.fontSize}px ${CANVAS_FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.opacity;

  const placements = layoutWatermark({
    pageWidth: pageWidthPt,
    pageHeight: pageHeightPt,
    lines,
    lineWidths: lines.map((line) => ctx.measureText(line).width),
    fontSize: style.fontSize,
    density: style.density,
    angleDeg: style.angle,
  });
  for (const p of placements) ctx.fillText(p.text, p.u, -p.v);
  ctx.restore();
}

export function canvasToBytes(canvas: HTMLCanvasElement, type: "image/jpeg" | "image/png", quality?: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Impossible d'encoder l'image (mémoire insuffisante ?)."));
          return;
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      type,
      quality,
    );
  });
}
