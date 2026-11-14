import assert from "node:assert/strict";
import { test } from "node:test";
import { hexToRgb01 } from "./color.ts";
import { dedupeNames, outputFileName } from "./filenames.ts";
import { evaluatePassword, generatePassword } from "./password-strength.ts";
import { normalizeStyle } from "./presets.ts";

test("nommage des fichiers de sortie", () => {
  assert.equal(outputFileName("avis_imposition_2025.pdf"), "avis_imposition_2025_filigrane.pdf");
  assert.equal(outputFileName("Photo CNI.recto.JPG"), "Photo CNI.recto_filigrane.pdf");
  assert.equal(outputFileName("sans-extension"), "sans-extension_filigrane.pdf");
  assert.equal(outputFileName(".pdf"), ".pdf_filigrane.pdf");
});

test("noms dédoublonnés dans le ZIP", () => {
  assert.deepEqual(dedupeNames(["a.pdf", "b.pdf", "a.pdf", "A.pdf"]), ["a.pdf", "b.pdf", "a (2).pdf", "A (3).pdf"]);
});

test("robustesse des mots de passe", () => {
  assert.equal(evaluatePassword("").level, 0);
  assert.ok(evaluatePassword("azerty").level <= 0);
  assert.ok(evaluatePassword("motdepasse2024").level <= 1);
  assert.ok(evaluatePassword("Soleil1990").level <= 1);
  assert.ok(evaluatePassword("k7Rm-2pXq-9vTz-Lh4w").level >= 3);
  assert.ok(evaluatePassword(generatePassword()).level >= 3);
});

test("mot de passe généré : format et unicité", () => {
  const pwd = generatePassword();
  assert.match(pwd, /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
  assert.notEqual(pwd, generatePassword());
});

test("un style stocké invalide est rejeté ou borné", () => {
  assert.equal(normalizeStyle(null), null);
  assert.equal(normalizeStyle({ angle: 45 }), null);
  const style = normalizeStyle({ text: "x", angle: 400, opacity: -1, fontSize: "12", color: "red", density: 3.6 });
  assert.deepEqual(style, { text: "x", angle: 90, opacity: 0.05, fontSize: 18, color: "#b91c1c", density: 4 });
});

test("conversion de couleur", () => {
  assert.deepEqual(hexToRgb01("#ff8000"), { r: 1, g: 128 / 255, b: 0 });
  assert.deepEqual(hexToRgb01("nope"), { r: 0, g: 0, b: 0 });
});
