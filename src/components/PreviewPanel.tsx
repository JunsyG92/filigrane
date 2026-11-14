"use client";

import { useEffect, useRef, useState } from "react";
import type { RenderTask } from "pdfjs-dist";
import { errorMessage } from "@/lib/errors";
import { loadPdfjs, openPdf } from "@/lib/pdfjs";
import type { WatermarkStyle } from "@/lib/types";
import { drawWatermarkOnCanvas } from "@/lib/watermark-canvas";
import { Spinner } from "./icons";

/** Résolution du rendu de base de l'aperçu (grand côté, en pixels). */
const PREVIEW_LONG_SIDE = 1600;

interface PreviewPanelProps {
  docId: string | null;
  docName: string | null;
  bytes: Uint8Array | null;
  pageCount: number;
  lines: readonly string[];
  style: WatermarkStyle;
}

interface BaseRender {
  docId: string;
  canvas: HTMLCanvasElement;
  widthPt: number;
  heightPt: number;
}

export default function PreviewPanel({ docId, docName, bytes, pageCount, lines, style }: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<BaseRender | null>(null);
  const [failure, setFailure] = useState<{ docId: string; message: string } | null>(null);

  // 1) Rendu de la première page, une seule fois par document.
  useEffect(() => {
    if (!docId || !bytes) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const { pdf, close } = await openPdf(bytes);
        try {
          const page = await pdf.getPage(1);
          const unit = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: PREVIEW_LONG_SIDE / Math.max(unit.width, unit.height) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          if (cancelled) return;
          task = page.render({
            canvas,
            viewport,
            intent: "print",
            annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE,
            background: "#ffffff",
          });
          await task.promise;
          if (!cancelled) setBase({ docId, canvas, widthPt: unit.width, heightPt: unit.height });
        } finally {
          close();
        }
      } catch (error) {
        if (!cancelled) setFailure({ docId, message: errorMessage(error) });
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [docId, bytes]);

  // 2) Incrustation du filigrane : instantanée à chaque changement de réglage.
  const currentBase = base && base.docId === docId ? base : null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentBase) return;
    const frame = requestAnimationFrame(() => {
      canvas.width = currentBase.canvas.width;
      canvas.height = currentBase.canvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(currentBase.canvas, 0, 0);
      drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
        lines,
        style,
        pageWidthPt: currentBase.widthPt,
        pageHeightPt: currentBase.heightPt,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentBase, lines, style]);

  const currentFailure = failure && failure.docId === docId ? failure : null;

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Aperçu</h2>
        {docName && (
          <p className="truncate text-xs text-slate-500" title={docName}>
            {docName} · page 1{pageCount > 1 ? ` sur ${pageCount}` : ""}
          </p>
        )}
      </div>
      <div className="relative flex h-[62vh] min-h-[380px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-200/60 p-4 lg:h-[calc(100vh-17rem)]">
        {!docId && (
          <p className="max-w-xs text-center text-sm text-slate-500">
            Importez un document : la première page s’affichera ici avec le filigrane, mise à jour en direct.
          </p>
        )}
        {docId && !currentBase && !currentFailure && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Rendu de l’aperçu…
          </p>
        )}
        {currentFailure && <p className="text-sm text-red-700">{currentFailure.message}</p>}
        <canvas
          ref={canvasRef}
          data-testid="preview-canvas"
          hidden={!currentBase}
          className="max-h-full max-w-full bg-white shadow-lg ring-1 ring-slate-900/5"
        />
      </div>
    </div>
  );
}
