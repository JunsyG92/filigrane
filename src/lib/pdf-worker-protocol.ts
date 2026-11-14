import type { DocErrorCode } from "./errors.ts";
import type { PdfJob } from "./pdf-build.ts";

export interface WorkerRequest {
  id: number;
  job: PdfJob;
}

export type WorkerResponse =
  | { type: "ready" }
  | { id: number; type: "progress"; done: number; total: number }
  | { id: number; type: "done"; bytes: Uint8Array }
  | { id: number; type: "error"; code: DocErrorCode; message: string };
