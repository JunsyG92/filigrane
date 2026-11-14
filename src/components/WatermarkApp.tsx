"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isReady, type DocItem, type DocResult, type DocState } from "@/lib/doc-state";
import { buildZip, downloadBytes } from "@/lib/download";
import { errorMessage, isAbortError } from "@/lib/errors";
import { importFile } from "@/lib/file-import";
import { outputFileName } from "@/lib/filenames";
import { DEFAULT_STYLE } from "@/lib/presets";
import { processDocument } from "@/lib/process";
import { deleteCustomPreset, loadCustomPreset, saveCustomPreset, type CustomPreset } from "@/lib/storage";
import { todayIso, watermarkLines } from "@/lib/template";
import type { WatermarkStyle, WatermarkVariables } from "@/lib/types";
import FileDropzone from "./FileDropzone";
import FileList from "./FileList";
import { AlertIcon, CheckIcon, DownloadIcon, Spinner } from "./icons";
import PreviewPanel from "./PreviewPanel";
import ProgressBar from "./ProgressBar";
import SettingsPanel, { type OutputSettings } from "./SettingsPanel";

type JobState =
  | { status: "idle" }
  | { status: "running"; fraction: number; label: string }
  | { status: "done"; succeeded: number; errors: { name: string; message: string }[] };

export default function WatermarkApp() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [style, setStyle] = useState<WatermarkStyle>(DEFAULT_STYLE);
  const [vars, setVars] = useState<WatermarkVariables>(() => ({ destinataire: "", objet: "", date: todayIso() }));
  const [output, setOutput] = useState<OutputSettings>({
    flatten: true,
    dpi: 200,
    passwordEnabled: false,
    password: "",
  });
  const [customPreset, setCustomPreset] = useState<CustomPreset | null>(() => loadCustomPreset());
  const [results, setResults] = useState<Record<string, DocResult>>({});
  const [job, setJob] = useState<JobState>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const importQueue = useRef<Promise<void>>(Promise.resolve());
  const idCounter = useRef(0);

  const lines = useMemo(() => watermarkLines(style.text, vars), [style.text, vars]);
  const password = output.passwordEnabled ? output.password : "";
  const settingsKey = useMemo(
    () =>
      JSON.stringify([lines, style.angle, style.opacity, style.fontSize, style.color, style.density, output.flatten, output.flatten ? output.dpi : 0, password]),
    [lines, style, output.flatten, output.dpi, password],
  );

  const readyDocs = docs.filter(isReady);
  const previewDoc = readyDocs.find((d) => d.id === selectedId) ?? readyDocs[0] ?? null;
  const running = job.status === "running";
  const importing = docs.some((d) => d.state.status === "loading");
  const validResults = docs.flatMap((d) => {
    const r = results[d.id];
    return r && r.settingsKey === settingsKey ? [r] : [];
  });

  // Un fichier lâché hors de la zone de dépôt ne doit pas être ouvert par le navigateur.
  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const addFiles = useCallback((files: File[]) => {
    const entries = files.map((file) => ({
      file,
      item: { id: `doc-${++idCounter.current}`, name: file.name, size: file.size, state: { status: "loading" } } satisfies DocItem,
    }));
    setDocs((prev) => [...prev, ...entries.map((e) => e.item)]);
    // Import séquentiel : limite la mémoire utilisée avec de gros fichiers.
    for (const { file, item } of entries) {
      importQueue.current = importQueue.current.then(async () => {
        let state: DocState;
        try {
          state = { status: "ready", ...(await importFile(file)) };
        } catch (error) {
          state = { status: "error", message: errorMessage(error) };
        }
        setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, state } : d)));
      });
    }
  }, []);

  const removeDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearAll = () => {
    setDocs([]);
    setResults({});
    setJob({ status: "idle" });
  };

  const generate = async () => {
    const targets = readyDocs;
    if (targets.length === 0 || lines.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const key = settingsKey;
    const settings = { lines, style, output: { flatten: output.flatten, dpi: output.dpi, password } };
    const totalPages = targets.reduce((sum, d) => sum + d.state.pageCount, 0);
    let donePages = 0;
    let succeeded = 0;
    const errors: { name: string; message: string }[] = [];

    for (const [index, doc] of targets.entries()) {
      const label = `${doc.name} (${index + 1}/${targets.length})`;
      setJob({ status: "running", fraction: donePages / totalPages, label });
      try {
        const bytes = await processDocument(
          doc.state.bytes,
          settings,
          (f) => setJob({ status: "running", fraction: (donePages + f * doc.state.pageCount) / totalPages, label }),
          controller.signal,
        );
        setResults((prev) => ({ ...prev, [doc.id]: { fileName: outputFileName(doc.name), bytes, settingsKey: key } }));
        succeeded++;
      } catch (error) {
        if (isAbortError(error)) {
          setJob({ status: "idle" });
          setNotice("Traitement annulé.");
          return;
        }
        errors.push({ name: doc.name, message: errorMessage(error) });
      }
      donePages += doc.state.pageCount;
    }
    abortRef.current = null;
    setJob({ status: "done", succeeded, errors });
  };

  const downloadOne = (id: string) => {
    const result = results[id];
    if (result) downloadBytes(result.bytes, result.fileName, "application/pdf");
  };

  const downloadAll = () => {
    if (validResults.length === 1) {
      downloadBytes(validResults[0].bytes, validResults[0].fileName, "application/pdf");
      return;
    }
    const zip = buildZip(validResults.map((r) => ({ name: r.fileName, bytes: r.bytes })));
    downloadBytes(zip, `documents_filigranes_${todayIso()}.zip`, "application/zip");
  };

  const saveCustom = () => {
    const preset: CustomPreset = { style, flatten: output.flatten, dpi: output.dpi };
    if (saveCustomPreset(preset)) {
      setCustomPreset(preset);
      setNotice("Modèle enregistré dans ce navigateur.");
    } else {
      setNotice("Impossible d’enregistrer (stockage local indisponible).");
    }
  };

  const blocker =
    readyDocs.length === 0
      ? importing
        ? "Analyse des documents en cours…"
        : "Importez au moins un document valide."
      : lines.length === 0
        ? "Saisissez le texte du filigrane."
        : output.passwordEnabled && !output.password
          ? "Saisissez un mot de passe ou désactivez la protection."
          : null;

  return (
    <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(250px,300px)_minmax(0,1fr)_minmax(320px,370px)]">
      <aside className="space-y-4" aria-label="Documents">
        <FileDropzone onFiles={addFiles} />
        <FileList
          docs={docs}
          results={results}
          settingsKey={settingsKey}
          previewId={previewDoc?.id ?? null}
          busy={running}
          onSelect={setSelectedId}
          onRemove={removeDoc}
          onDownload={downloadOne}
          onClear={clearAll}
        />
      </aside>

      <main className="min-w-0 space-y-3 lg:sticky lg:top-14 lg:self-start">
        <PreviewPanel
          docId={previewDoc?.id ?? null}
          docName={previewDoc?.name ?? null}
          bytes={previewDoc?.state.bytes ?? null}
          pageCount={previewDoc?.state.pageCount ?? 0}
          lines={lines}
          style={style}
        />

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-testid="export-panel">
          {running ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <ProgressBar fraction={job.fraction} label={`Traitement : ${job.label}`} />
              </div>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={generate}
                disabled={blocker !== null}
                data-testid="generate"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {readyDocs.length > 1 ? `Filigraner les ${readyDocs.length} documents` : "Filigraner le document"}
              </button>
              {validResults.length > 0 && (
                <button
                  type="button"
                  onClick={downloadAll}
                  data-testid="download-all"
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
                >
                  <DownloadIcon width={16} height={16} />
                  {validResults.length > 1 ? `Télécharger le ZIP (${validResults.length} PDF)` : "Télécharger le PDF"}
                </button>
              )}
              {blocker && (
                <span className="flex items-center gap-2 text-sm text-slate-500">
                  {importing && readyDocs.length === 0 && <Spinner className="size-3" />}
                  {blocker}
                </span>
              )}
            </div>
          )}

          {job.status === "done" && (
            <div className="space-y-1.5 text-sm" data-testid="job-summary">
              {job.succeeded > 0 && (
                <p className="flex items-center gap-1.5 text-emerald-800">
                  <CheckIcon width={16} height={16} />
                  {job.succeeded} document{job.succeeded > 1 ? "s" : ""} filigrané{job.succeeded > 1 ? "s" : ""}
                  {password ? ", protégé" + (job.succeeded > 1 ? "s" : "") + " par mot de passe" : ""}.
                </p>
              )}
              {job.errors.map((e) => (
                <p key={e.name} className="flex items-start gap-1.5 text-red-700">
                  <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
                  <span>
                    <strong className="font-medium">{e.name}</strong> : {e.message}
                  </span>
                </p>
              ))}
            </div>
          )}
          {notice && (
            <p className="text-sm text-slate-600" role="status">
              {notice}
            </p>
          )}
        </div>
      </main>

      <aside aria-label="Réglages">
        <SettingsPanel
          style={style}
          onStyleChange={setStyle}
          vars={vars}
          onVarsChange={setVars}
          output={output}
          onOutputChange={setOutput}
          customPreset={customPreset}
          onSaveCustom={saveCustom}
          onDeleteCustom={() => {
            deleteCustomPreset();
            setCustomPreset(null);
          }}
        />
      </aside>
    </div>
  );
}
