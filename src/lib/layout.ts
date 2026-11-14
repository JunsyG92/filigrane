/**
 * Géométrie de la mosaïque, partagée par le rendu canvas (aperçu + aplatissement)
 * et le rendu vectoriel pdf-lib, pour que les deux sorties soient identiques.
 *
 * Repère : origine au centre de la page, axe y vers le haut, puis rotation de
 * `angleDeg` dans le sens anti-horaire. Chaque placement donne la position du
 * début de ligne (u) et de sa ligne de base (v) dans ce repère tourné.
 */

export const LINE_HEIGHT_FACTOR = 1.3;
const CAP_HEIGHT_FACTOR = 0.72;

export interface TileLayoutInput {
  pageWidth: number;
  pageHeight: number;
  lines: readonly string[];
  /** Largeur de chaque ligne, dans la même unité que pageWidth, à la taille fontSize. */
  lineWidths: readonly number[];
  fontSize: number;
  density: number;
  angleDeg: number;
}

export interface TextPlacement {
  text: string;
  u: number;
  v: number;
}

export function tileSteps(blockWidth: number, blockHeight: number, fontSize: number, density: number) {
  const d = Math.min(10, Math.max(1, Math.round(density)));
  const gap = fontSize * (11 - d) * 0.9;
  return { stepX: blockWidth + gap * 1.6, stepY: blockHeight + gap };
}

export function layoutWatermark(input: TileLayoutInput): TextPlacement[] {
  const { pageWidth, pageHeight, lines, lineWidths, fontSize, density, angleDeg } = input;
  if (lines.length === 0 || fontSize <= 0 || pageWidth <= 0 || pageHeight <= 0) return [];

  const lineHeight = fontSize * LINE_HEIGHT_FACTOR;
  const blockWidth = Math.max(fontSize, ...lineWidths);
  const blockHeight = lines.length * lineHeight;
  const { stepX, stepY } = tileSteps(blockWidth, blockHeight, fontSize, density);

  const halfW = pageWidth / 2;
  const halfH = pageHeight / 2;
  const reach = Math.hypot(blockWidth, blockHeight) / 2;
  const radius = Math.hypot(halfW, halfH) + reach;
  const rows = Math.ceil(radius / stepY) + 1;
  const cols = Math.ceil(radius / stepX) + 1;

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const placements: TextPlacement[] = [];

  for (let r = -rows; r <= rows; r++) {
    const offset = Math.abs(r) % 2 === 1 ? stepX / 2 : 0;
    const cv = r * stepY;
    for (let c = -cols; c <= cols; c++) {
      const cu = c * stepX + offset;
      // Centre de la tuile dans le repère de la page : on écarte celles hors page.
      const px = cu * cos - cv * sin;
      const py = cu * sin + cv * cos;
      if (Math.abs(px) > halfW + reach || Math.abs(py) > halfH + reach) continue;

      lines.forEach((text, i) => {
        const top = cv + blockHeight / 2 - i * lineHeight;
        placements.push({
          text,
          u: cu - (lineWidths[i] ?? 0) / 2,
          v: top - lineHeight / 2 - (fontSize * CAP_HEIGHT_FACTOR) / 2,
        });
      });
    }
  }
  return placements;
}

/** Convertit un placement en coordonnées de page (y vers le haut) autour du centre (cx, cy). */
export function placementToPage(p: TextPlacement, cx: number, cy: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: cx + p.u * cos - p.v * sin, y: cy + p.u * sin + p.v * cos };
}
