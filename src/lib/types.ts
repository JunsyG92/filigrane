export const DPI_OPTIONS = [150, 200, 300] as const;
export type Dpi = (typeof DPI_OPTIONS)[number];

/** Apparence du filigrane. Les tailles sont exprimées en points PDF (1/72 de pouce). */
export interface WatermarkStyle {
  /** Texte multi-lignes, peut contenir {date}, {destinataire}, {objet}. */
  text: string;
  /** Angle en degrés, sens anti-horaire (45 = diagonale montante). */
  angle: number;
  /** Opacité entre 0 et 1. */
  opacity: number;
  /** Taille de police en points. */
  fontSize: number;
  /** Couleur au format #rrggbb. */
  color: string;
  /** Densité de la mosaïque : 1 (aérée) à 10 (serrée). */
  density: number;
}

export interface WatermarkVariables {
  destinataire: string;
  objet: string;
  /** Date au format AAAA-MM-JJ (valeur d'un <input type="date">). */
  date: string;
}

export interface OutputOptions {
  flatten: boolean;
  dpi: Dpi;
  /** Chaîne vide = pas de chiffrement. */
  password: string;
}

export const STYLE_LIMITS = {
  angle: { min: -90, max: 90 },
  opacity: { min: 0.05, max: 1 },
  fontSize: { min: 8, max: 96 },
  density: { min: 1, max: 10 },
} as const;
