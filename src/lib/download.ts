import { zipSync, type Zippable } from "fflate";
import { dedupeNames } from "./filenames.ts";

/** Déclenche un téléchargement local (URL blob:, aucune requête réseau). */
export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy.buffer], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function buildZip(files: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const names = dedupeNames(files.map((f) => f.name));
  const entries: Zippable = {};
  // Les PDF sont déjà compressés : on stocke sans recompresser (level 0), bien plus rapide.
  files.forEach((file, i) => {
    entries[names[i]] = [file.bytes, { level: 0 }];
  });
  return zipSync(entries);
}
