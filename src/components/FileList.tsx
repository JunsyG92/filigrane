"use client";

import type { DocItem, DocResult } from "@/lib/doc-state";
import { formatBytes } from "@/lib/filenames";
import { AlertIcon, DownloadIcon, FileIcon, ImageIcon, Spinner, TrashIcon } from "./icons";

interface FileListProps {
  docs: readonly DocItem[];
  results: Readonly<Record<string, DocResult>>;
  settingsKey: string;
  previewId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (id: string) => void;
  onClear: () => void;
}

export default function FileList({
  docs,
  results,
  settingsKey,
  previewId,
  busy,
  onSelect,
  onRemove,
  onDownload,
  onClear,
}: FileListProps) {
  if (docs.length === 0) {
    return <p className="px-1 text-sm text-slate-500">Aucun document importé pour l’instant.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Documents ({docs.length})
        </h2>
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="text-xs font-medium text-slate-500 hover:text-red-700 disabled:opacity-40"
        >
          Tout retirer
        </button>
      </div>
      <ul className="space-y-2" data-testid="doc-list">
        {docs.map((doc) => {
          const { state } = doc;
          const result = results[doc.id];
          const resultValid = result?.settingsKey === settingsKey;
          const selected = doc.id === previewId;
          const Icon = state.status === "ready" && state.kind !== "pdf" ? ImageIcon : FileIcon;

          return (
            <li
              key={doc.id}
              data-testid="doc-item"
              data-status={state.status}
              className={`rounded-lg border bg-white p-2.5 transition-colors ${
                state.status === "error"
                  ? "border-red-200 bg-red-50/60"
                  : selected
                    ? "border-teal-600 ring-1 ring-teal-600"
                    : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  disabled={state.status !== "ready"}
                  onClick={() => onSelect(doc.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-default"
                  title={state.status === "ready" ? "Afficher l’aperçu" : undefined}
                >
                  <span className={`mt-0.5 ${state.status === "error" ? "text-red-600" : "text-slate-500"}`}>
                    {state.status === "error" ? <AlertIcon /> : <Icon />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800" title={doc.name}>
                      {doc.name}
                    </span>
                    {state.status === "loading" && (
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <Spinner className="size-3" /> Analyse en cours…
                      </span>
                    )}
                    {state.status === "ready" && (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {state.pageCount} page{state.pageCount > 1 ? "s" : ""} · {formatBytes(doc.size)}
                        {state.kind !== "pdf" && " · image convertie en A4"}
                      </span>
                    )}
                    {state.status === "error" && (
                      <span className="mt-0.5 block text-xs text-red-700" data-testid="doc-error">
                        {state.message}
                      </span>
                    )}
                    {result && (
                      <span
                        className={`mt-1 block text-xs ${resultValid ? "text-emerald-700" : "text-amber-700"}`}
                        data-testid="doc-result"
                      >
                        {resultValid
                          ? `Prêt · ${result.fileName} · ${formatBytes(result.bytes.byteLength)}`
                          : "Réglages modifiés — à régénérer"}
                      </span>
                    )}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  {result && resultValid && (
                    <button
                      type="button"
                      onClick={() => onDownload(doc.id)}
                      className="rounded-md p-1.5 text-teal-700 hover:bg-teal-50"
                      aria-label={`Télécharger ${result.fileName}`}
                      title="Télécharger"
                    >
                      <DownloadIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(doc.id)}
                    disabled={busy}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-700 disabled:opacity-40"
                    aria-label={`Retirer ${doc.name}`}
                    title="Retirer"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
