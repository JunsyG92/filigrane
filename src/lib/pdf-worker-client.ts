import { DocError } from "./errors.ts";
import type { PdfJob, ProgressCallback } from "./pdf-build.ts";
import type { WorkerRequest, WorkerResponse } from "./pdf-worker-protocol.ts";

interface Pending {
  resolve: (bytes: Uint8Array) => void;
  reject: (error: Error) => void;
  onProgress?: ProgressCallback;
}

/** Délai maximal pour que le worker signale qu'il est prêt avant de basculer sur le thread principal. */
const READY_TIMEOUT_MS = 10_000;

let workerPromise: Promise<Worker | null> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function rejectAll(message: string): void {
  for (const entry of pending.values()) entry.reject(new Error(message));
  pending.clear();
}

function startWorker(): Promise<Worker | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/pdf.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve(null);
      return;
    }

    let ready = false;
    const fail = () => {
      worker.terminate();
      workerPromise = Promise.resolve(null);
      resolve(null);
    };
    const timer = setTimeout(() => {
      if (!ready) fail();
    }, READY_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "ready") {
        ready = true;
        clearTimeout(timer);
        resolve(worker);
        return;
      }
      const entry = pending.get(msg.id);
      if (!entry) return;
      if (msg.type === "progress") {
        entry.onProgress?.(msg.done, msg.total);
        return;
      }
      pending.delete(msg.id);
      if (msg.type === "done") entry.resolve(msg.bytes);
      else entry.reject(new DocError(msg.code, msg.message));
    };

    worker.onerror = (event) => {
      event.preventDefault();
      clearTimeout(timer);
      if (!ready) {
        fail();
        return;
      }
      // Plantage en cours de route : on relancera un worker neuf au prochain job.
      rejectAll("Le traitement PDF s'est arrêté de façon inattendue.");
      worker.terminate();
      workerPromise = null;
    };
  });
}

function transferables(job: PdfJob): Transferable[] {
  const buffers = job.kind === "raster" ? job.pages.map((p) => p.image.buffer) : [job.source.buffer];
  return buffers.filter((b): b is ArrayBuffer => b instanceof ArrayBuffer);
}

/**
 * Exécute la construction PDF dans un Web Worker (UI non bloquée).
 * Les tampons du job sont TRANSFÉRÉS au worker : l'appelant doit passer des copies.
 * Si le worker ne peut pas démarrer, le travail est fait sur le thread principal.
 */
export async function runPdfJob(job: PdfJob, onProgress?: ProgressCallback): Promise<Uint8Array> {
  workerPromise ??= startWorker();
  const worker = await workerPromise;
  if (!worker) {
    const { buildPdf } = await import("./pdf-build.ts");
    return buildPdf(job, onProgress);
  }
  const id = nextId++;
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    const request: WorkerRequest = { id, job };
    worker.postMessage(request, transferables(job));
  });
}
