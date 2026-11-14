/**
 * Construction des PDF de sortie avec @cantoo/pdf-lib (fork de pdf-lib qui gère le chiffrement).
 * Aucune dépendance au DOM : ce module tourne dans un Web Worker.
 */
import {
  EncryptedPDFError,
  PDFDocument,
  PDFName,
  PDFRef,
  StandardFonts,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
  setFontAndSize,
  setGraphicsState,
  setTextMatrix,
  showText,
} from "@cantoo/pdf-lib";
import { hexToRgb01 } from "./color.ts";
import { DocError, MESSAGES } from "./errors.ts";
import { layoutWatermark, placementToPage } from "./layout.ts";
import type { WatermarkStyle } from "./types.ts";

export interface RasterPage {
  image: Uint8Array;
  imageFormat: "jpeg" | "png";
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PdfJob =
  | { kind: "raster"; pages: RasterPage[]; password: string; stripMetadata: boolean }
  | { kind: "vector"; source: Uint8Array; lines: string[]; style: WatermarkStyle; password: string };

export type ProgressCallback = (done: number, total: number) => void;

export async function buildPdf(job: PdfJob, onProgress?: ProgressCallback): Promise<Uint8Array> {
  return job.kind === "raster" ? buildRaster(job, onProgress) : buildVector(job, onProgress);
}

async function buildRaster(
  job: Extract<PdfJob, { kind: "raster" }>,
  onProgress?: ProgressCallback,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  for (const [i, p] of job.pages.entries()) {
    const image = p.imageFormat === "png" ? await doc.embedPng(p.image) : await doc.embedJpg(p.image);
    const page = doc.addPage([p.pageWidth, p.pageHeight]);
    page.drawImage(image, { x: p.x, y: p.y, width: p.width, height: p.height });
    onProgress?.(i + 1, job.pages.length);
  }
  if (job.stripMetadata) stripMetadata(doc);
  applyPassword(doc, job.password);
  return doc.save();
}

async function loadEditable(source: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(source, { updateMetadata: false });
  } catch (error) {
    if (error instanceof EncryptedPDFError) throw new DocError("protected", MESSAGES.restrictedPdf);
    throw new DocError("corrupt", MESSAGES.corruptPdf);
  }
}

/** Remplace les caractères absents de l'encodage WinAnsi d'Helvetica (emoji, etc.). */
function sanitizeForFont(text: string, supported: ReadonlySet<number>): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    out += supported.has(code) ? ch : "?";
  }
  return out;
}

async function buildVector(
  job: Extract<PdfJob, { kind: "vector" }>,
  onProgress?: ProgressCallback,
): Promise<Uint8Array> {
  const doc = await loadEditable(job.source);
  const pages = doc.getPages();
  if (pages.length === 0) throw new DocError("empty", MESSAGES.emptyPdf);

  const { style } = job;
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(font.getCharacterSet());
  const lines = job.lines.map((l) => sanitizeForFont(l, supported));
  const widths = lines.map((l) => font.widthOfTextAtSize(l, style.fontSize));
  const { r, g, b } = hexToRgb01(style.color);
  const gsRef = doc.context.register(
    doc.context.obj({ Type: "ExtGState", ca: style.opacity, CA: style.opacity }),
  );

  for (const [i, page] of pages.entries()) {
    // Isole le contenu existant dans q…Q : un état graphique laissé ouvert par le
    // document (matrice, couleur) ne doit pas déformer ni masquer le filigrane.
    page.node.normalize();
    const start = doc.context.register(doc.context.contentStream([pushGraphicsState()]));
    const end = doc.context.register(doc.context.contentStream([popGraphicsState()]));
    page.node.wrapContentStreams(start, end);

    const box = page.getCropBox();
    // /Rotate fait tourner l'affichage dans le sens horaire : on compense pour que
    // l'angle perçu par le lecteur soit celui choisi.
    const angle = style.angle + page.getRotation().angle;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const placements = layoutWatermark({
      pageWidth: box.width,
      pageHeight: box.height,
      lines,
      lineWidths: widths,
      fontSize: style.fontSize,
      density: style.density,
      angleDeg: angle,
    });

    const fontName = page.node.newFontDictionary(font.name, font.ref);
    const gsName = page.node.newExtGState("GS", gsRef);
    const operators = [
      pushGraphicsState(),
      setGraphicsState(gsName),
      setFillingRgbColor(r, g, b),
      beginText(),
      setFontAndSize(fontName, style.fontSize),
    ];
    for (const p of placements) {
      const { x, y } = placementToPage(p, cx, cy, angle);
      operators.push(setTextMatrix(cos, sin, -sin, cos, x, y), showText(font.encodeText(p.text)));
    }
    operators.push(endText(), popGraphicsState());
    page.pushOperators(...operators);
    onProgress?.(i + 1, pages.length);
  }

  stripMetadata(doc);
  applyPassword(doc, job.password);
  return doc.save();
}

const METADATA_KEYS = ["Metadata", "PieceInfo"] as const;

/** Supprime le dictionnaire Info (auteur, logiciel, dates) et les métadonnées XMP. */
export function stripMetadata(doc: PDFDocument): void {
  const info = doc.context.trailerInfo.Info;
  if (info instanceof PDFRef) doc.context.delete(info);
  doc.context.trailerInfo.Info = undefined;
  for (const key of METADATA_KEYS) {
    doc.catalog.delete(PDFName.of(key));
    for (const page of doc.getPages()) page.node.delete(PDFName.of(key));
  }
}

function randomOwnerPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chiffrement AES-256 : ouverture avec le mot de passe, modification et copie interdites. */
function applyPassword(doc: PDFDocument, password: string): void {
  if (!password) return;
  doc.encrypt({
    userPassword: password,
    ownerPassword: randomOwnerPassword(),
    algorithm: "AES-256",
    permissions: {
      printing: "highResolution",
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });
}
