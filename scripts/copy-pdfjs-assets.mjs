// Copie les ressources de pdf.js (worker, wasm, cmaps, polices, profils ICC) dans public/pdfjs
// pour qu'elles soient servies par l'application elle-même, sans aucun CDN.
import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const pdfjsDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const target = path.join(root, "public", "pdfjs");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(path.join(pdfjsDir, "build", "pdf.worker.min.mjs"), path.join(target, "pdf.worker.min.mjs"));
for (const dir of ["wasm", "cmaps", "standard_fonts", "iccs"]) {
  await cp(path.join(pdfjsDir, dir), path.join(target, dir), { recursive: true });
}
console.log("pdf.js : ressources copiées dans public/pdfjs");
