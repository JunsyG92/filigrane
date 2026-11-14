import type { PDFDocumentProxy } from "pdfjs-dist";
import { fromPdfjsError } from "./errors.ts";

type PdfjsModule = typeof import("pdfjs-dist");

let modulePromise: Promise<PdfjsModule> | null = null;

/** Les ressources de pdf.js sont servies localement (copiées dans public/pdfjs), jamais depuis un CDN. */
function assetUrl(path: string): string {
  return new URL(`pdfjs/${path}`, document.baseURI).href;
}

export function loadPdfjs(): Promise<PdfjsModule> {
  modulePromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = assetUrl("pdf.worker.min.mjs");
    return pdfjs;
  });
  return modulePromise;
}

export interface OpenedPdf {
  pdf: PDFDocumentProxy;
  /** Libère le document et la mémoire associée côté worker pdf.js. */
  close: () => void;
}

export async function openPdf(bytes: Uint8Array): Promise<OpenedPdf> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    // pdf.js transfère le tampon à son worker : on lui donne une copie.
    data: bytes.slice(),
    wasmUrl: assetUrl("wasm/"),
    cMapUrl: assetUrl("cmaps/"),
    cMapPacked: true,
    iccUrl: assetUrl("iccs/"),
    standardFontDataUrl: assetUrl("standard_fonts/"),
    enableXfa: false,
  });
  const close = () => void task.destroy();
  try {
    return { pdf: await task.promise, close };
  } catch (error) {
    close();
    throw fromPdfjsError(error);
  }
}
