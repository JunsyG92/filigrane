export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type DocErrorCode = "unsupported" | "too-large" | "corrupt" | "protected" | "empty" | "unknown";

export class DocError extends Error {
  readonly code: DocErrorCode;

  constructor(code: DocErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DocError";
  }
}

export const MESSAGES = {
  unsupported: "Format non supporté. Formats acceptés : PDF, JPG, PNG.",
  tooLarge: `Fichier trop volumineux (maximum ${MAX_FILE_SIZE / 1024 / 1024} Mo).`,
  corruptPdf: "PDF corrompu ou illisible.",
  corruptImage: "Image corrompue ou illisible.",
  protectedPdf:
    "PDF protégé par mot de passe. Ouvrez-le et enregistrez une copie sans protection avant de l'importer.",
  restrictedPdf:
    "Ce PDF comporte des restrictions de sécurité qui empêchent de le modifier. Activez l'option « Aplatir » pour le traiter.",
  emptyPdf: "Ce PDF ne contient aucune page.",
} as const;

export function errorMessage(error: unknown): string {
  if (error instanceof DocError) return error.message;
  if (error instanceof Error && error.message) return `Erreur inattendue : ${error.message}`;
  return "Erreur inattendue.";
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Traduit les exceptions de pdf.js (identifiées par leur nom) en erreurs lisibles. */
export function fromPdfjsError(error: unknown): DocError {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException") return new DocError("protected", MESSAGES.protectedPdf);
  if (name === "InvalidPDFException" || name === "FormatError" || name === "UnknownErrorException") {
    return new DocError("corrupt", MESSAGES.corruptPdf);
  }
  if (error instanceof DocError) return error;
  return new DocError("corrupt", MESSAGES.corruptPdf);
}
