import path from "node:path";

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;
function pdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<PdfjsModule>;
  return pdfjsPromise;
}

const STANDARD_FONTS = `${path.resolve("node_modules/pdfjs-dist/standard_fonts")}/`;

export interface TextRun {
  str: string;
  /** Position dans l'espace utilisateur de la page. */
  x: number;
  y: number;
  /** Angle du texte tel que le lecteur le voit (rotation /Rotate de la page incluse), en degrés. */
  angle: number;
}

export interface PdfInspection {
  pageCount: number;
  pageSizes: { width: number; height: number }[];
  pageText: string[];
  pageRuns: TextRun[][];
  info: Record<string, unknown>;
  hasXmp: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export async function inspectPdf(bytes: Uint8Array, password?: string): Promise<PdfInspection> {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: bytes.slice(), password, verbosity: 0, standardFontDataUrl: STANDARD_FONTS });
  try {
    const doc = await task.promise;
    const pageSizes: PdfInspection["pageSizes"] = [];
    const pageText: string[] = [];
    const pageRuns: TextRun[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      pageSizes.push({ width: Math.round(viewport.width), height: Math.round(viewport.height) });
      const content = await page.getTextContent();
      const runs = content.items.flatMap((item): TextRun[] => {
        if (!("str" in item)) return [];
        const matrix = item.transform.map(Number);
        const shown = lib.Util.transform(viewport.transform, matrix);
        // Repère écran : y vers le bas, d'où le signe inversé.
        const angle = Math.round((Math.atan2(-shown[1], shown[0]) * 180) / Math.PI);
        return [{ str: item.str, x: matrix[4], y: matrix[5], angle }];
      });
      pageRuns.push(runs);
      pageText.push(runs.map((r) => r.str).join(" "));
    }
    const meta = await doc.getMetadata();
    return { pageCount: doc.numPages, pageSizes, pageText, pageRuns, info: asRecord(meta.info), hasXmp: meta.metadata !== null };
  } finally {
    await task.destroy();
  }
}

export async function requiresPassword(bytes: Uint8Array): Promise<boolean> {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    await task.promise;
    return false;
  } catch (error) {
    return error instanceof Error && error.name === "PasswordException";
  } finally {
    await task.destroy();
  }
}
