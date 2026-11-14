import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Page } from "@playwright/test";

// Build CommonJS du fork pdf-lib (sa version ESM n'est pas chargeable telle quelle par Node).
const require = createRequire(import.meta.url);
const lib = require("@cantoo/pdf-lib") as typeof import("@cantoo/pdf-lib");

export const FIXTURE_DIR = path.resolve("test-results", "fixtures");
export const OUTPUT_DIR = path.resolve("test-results", "outputs");
export const SECRET_NAME = "Jean Dupont";

async function drawDocumentPage(doc: import("@cantoo/pdf-lib").PDFDocument, size: [number, number], title: string) {
  const font = await doc.embedFont(lib.StandardFonts.Helvetica);
  const page = doc.addPage(size);
  const [, height] = size;
  page.drawText(title, { x: 50, y: height - 70, size: 22, font });
  page.drawText(`Contribuable : ${SECRET_NAME}`, { x: 50, y: height - 110, size: 14, font });
  page.drawText("Revenu fiscal de reference : 42 000 EUR", { x: 50, y: height - 135, size: 14, font });
  for (let i = 0; i < 12; i++) {
    page.drawRectangle({ x: 50, y: height - 180 - i * 28, width: size[0] - 100, height: 1, color: lib.rgb(0.6, 0.6, 0.6) });
  }
  return page;
}

/** PDF de 4 pages : portrait, paysage, page avec /Rotate 90, page qui laisse la matrice graphique modifiée. */
export async function multiPagePdf(): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create();
  doc.setTitle("Titre confidentiel");
  doc.setAuthor(SECRET_NAME);
  doc.setCreator("CreateurTest");
  doc.setProducer("ProducteurTest");
  await drawDocumentPage(doc, [595.28, 841.89], "Page 1 - Avis d'imposition (fictif)");
  await drawDocumentPage(doc, [841.89, 595.28], "Page 2 - Bilan comptable paysage");
  const rotated = await drawDocumentPage(doc, [595.28, 841.89], "Page 3 - page tournee de 90 degres");
  rotated.setRotation(lib.degrees(90));
  const unbalanced = await drawDocumentPage(doc, [595.28, 841.89], "Page 4 - matrice non restauree");
  // Contenu mal formé fréquent : un « cm » sans q/Q qui réduirait tout ce qui est dessiné ensuite.
  unbalanced.pushOperators(lib.concatTransformationMatrix(0.2, 0, 0, 0.2, 0, 0));
  return doc.save();
}

export async function encryptedPdf(userPassword: string): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create();
  await drawDocumentPage(doc, [595.28, 841.89], "Fiche de paie protegee");
  doc.encrypt({ userPassword, ownerPassword: "proprietaire-123", permissions: { modifying: false, copying: false } });
  return doc.save();
}

/** Génère une photo JPEG (paysage) et un scan PNG (portrait, avec transparence) dans le navigateur. */
export async function sampleImages(page: Page): Promise<{ jpeg: Buffer; png: Buffer }> {
  const [jpeg, png] = await page.evaluate(() => {
    const draw = (width: number, height: number, label: string, transparent: boolean) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      if (!transparent) {
        ctx.fillStyle = "#dbeafe";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(40, 40, width * 0.3, height * 0.45);
      ctx.font = `bold ${Math.round(height / 12)}px sans-serif`;
      ctx.fillText(label, 40 + width * 0.33, height * 0.25);
      ctx.font = `${Math.round(height / 18)}px sans-serif`;
      ctx.fillText("DUPONT Jean — né le 01/01/1990", 40 + width * 0.33, height * 0.4);
      return canvas;
    };
    return [
      draw(1600, 1000, "CARTE D'IDENTITÉ (fictive)", false).toDataURL("image/jpeg", 0.9),
      draw(900, 1273, "RIB (fictif)", true).toDataURL("image/png"),
    ];
  });
  const decode = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  return { jpeg: decode(jpeg), png: decode(png) };
}

export async function writeFixture(name: string, bytes: Uint8Array | Buffer | string): Promise<string> {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const file = path.join(FIXTURE_DIR, name);
  await writeFile(file, bytes);
  return file;
}
