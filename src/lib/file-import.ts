import { DocError, MAX_FILE_SIZE, MESSAGES } from "./errors.ts";
import { runPdfJob } from "./pdf-worker-client.ts";
import { openPdf } from "./pdfjs.ts";
import { canvasToBytes } from "./watermark-canvas.ts";

export type SourceKind = "pdf" | "jpeg" | "png";

export interface ImportedDocument {
  kind: SourceKind;
  /** Document source au format PDF (les images sont converties). */
  bytes: Uint8Array;
  pageCount: number;
}

export const ACCEPTED_INPUT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const A4 = { width: 595.28, height: 841.89 };
const IMAGE_MARGIN = 28; // ≈ 1 cm
const MAX_IMAGE_SIDE = 3508; // grand côté d'un A4 à 300 dpi

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

function extensionKind(name: string): SourceKind | null {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  return null;
}

/** Identifie le format par signature binaire (le nom ou le type MIME peuvent mentir). */
async function detectKind(file: File): Promise<SourceKind> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  const headText = new TextDecoder("latin1").decode(head);
  if (headText.includes("%PDF-")) return "pdf";

  const claimed = extensionKind(file.name);
  if (claimed === "pdf") throw new DocError("corrupt", MESSAGES.corruptPdf);
  if (claimed) throw new DocError("corrupt", MESSAGES.corruptImage);
  throw new DocError("unsupported", MESSAGES.unsupported);
}

/**
 * Image → PDF d'une page A4 (orientation selon l'image, ratio conservé).
 * L'image est redessinée sur un canvas : l'orientation EXIF est appliquée et
 * les métadonnées (EXIF, GPS…) disparaissent.
 */
async function imageToPdf(file: File, kind: "jpeg" | "png"): Promise<Uint8Array> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new DocError("corrupt", MESSAGES.corruptImage);
  }

  const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new DocError("unknown", "Canvas indisponible dans ce navigateur.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = await canvasToBytes(canvas, kind === "png" ? "image/png" : "image/jpeg", 0.92);
  canvas.width = 0;
  canvas.height = 0;

  const landscape = width > height;
  const pageWidth = landscape ? A4.height : A4.width;
  const pageHeight = landscape ? A4.width : A4.height;
  const scale = Math.min((pageWidth - 2 * IMAGE_MARGIN) / width, (pageHeight - 2 * IMAGE_MARGIN) / height);
  const drawW = width * scale;
  const drawH = height * scale;

  return runPdfJob({
    kind: "raster",
    stripMetadata: true,
    password: "",
    pages: [
      {
        image,
        imageFormat: kind,
        pageWidth,
        pageHeight,
        x: (pageWidth - drawW) / 2,
        y: (pageHeight - drawH) / 2,
        width: drawW,
        height: drawH,
      },
    ],
  });
}

export async function importFile(file: File): Promise<ImportedDocument> {
  if (file.size === 0) throw new DocError("corrupt", "Fichier vide.");
  if (file.size > MAX_FILE_SIZE) throw new DocError("too-large", MESSAGES.tooLarge);

  const kind = await detectKind(file);
  const bytes = kind === "pdf" ? new Uint8Array(await file.arrayBuffer()) : await imageToPdf(file, kind);

  // Validation complète : ouverture par pdf.js (détecte PDF corrompu ou protégé).
  const { pdf, close } = await openPdf(bytes);
  try {
    if (pdf.numPages === 0) throw new DocError("empty", MESSAGES.emptyPdf);
    return { kind, bytes, pageCount: pdf.numPages };
  } finally {
    close();
  }
}
