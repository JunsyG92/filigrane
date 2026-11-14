import { DocError } from "../lib/errors.ts";
import { buildPdf } from "../lib/pdf-build.ts";
import type { WorkerRequest, WorkerResponse } from "../lib/pdf-worker-protocol.ts";

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event) => {
  const { id, job } = event.data;
  try {
    const bytes = await buildPdf(job, (done, total) => scope.postMessage({ id, type: "progress", done, total }));
    scope.postMessage({ id, type: "done", bytes }, [bytes.buffer]);
  } catch (error) {
    if (error instanceof DocError) {
      scope.postMessage({ id, type: "error", code: error.code, message: error.message });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      scope.postMessage({ id, type: "error", code: "unknown", message: `Erreur inattendue : ${message}` });
    }
  }
};

// Signale au thread principal que le worker a bien été chargé et exécuté.
scope.postMessage({ type: "ready" });
