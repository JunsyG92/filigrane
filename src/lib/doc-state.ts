import type { SourceKind } from "./file-import.ts";

export type DocState =
  | { status: "loading" }
  | { status: "ready"; kind: SourceKind; bytes: Uint8Array; pageCount: number }
  | { status: "error"; message: string };

export interface DocItem {
  id: string;
  name: string;
  size: number;
  state: DocState;
}

export type ReadyDoc = DocItem & { state: Extract<DocState, { status: "ready" }> };

export function isReady(doc: DocItem): doc is ReadyDoc {
  return doc.state.status === "ready";
}

export interface DocResult {
  fileName: string;
  bytes: Uint8Array;
  /** Empreinte des réglages utilisés : le résultat est périmé si les réglages changent. */
  settingsKey: string;
}
