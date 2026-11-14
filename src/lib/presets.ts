import { isHexColor } from "./color.ts";
import { DPI_OPTIONS, STYLE_LIMITS, type Dpi, type WatermarkStyle } from "./types.ts";

export interface Preset {
  id: string;
  label: string;
  style: WatermarkStyle;
}

export const BUILTIN_PRESETS: readonly Preset[] = [
  {
    id: "location",
    label: "Dossier de location",
    style: {
      text: "Dossier de location — ne peut être utilisé à d'autres fins",
      angle: 45,
      opacity: 0.25,
      fontSize: 18,
      color: "#b91c1c",
      density: 5,
    },
  },
  {
    id: "copie",
    label: "Copie",
    style: {
      text: "Copie — reproduction interdite",
      angle: 45,
      opacity: 0.22,
      fontSize: 26,
      color: "#374151",
      density: 4,
    },
  },
  {
    id: "nominatif",
    label: "Transmission nominative",
    style: {
      text: "Transmis à {destinataire} le {date}\nusage strictement limité à {objet}",
      angle: 45,
      opacity: 0.25,
      fontSize: 16,
      color: "#1e3a8a",
      density: 5,
    },
  },
];

export const DEFAULT_STYLE: WatermarkStyle = BUILTIN_PRESETS[0].style;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Valide et borne un style venant d'une source non fiable (localStorage). */
export function normalizeStyle(value: unknown): WatermarkStyle | null {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  const L = STYLE_LIMITS;
  return {
    text: value.text.slice(0, 500),
    angle: clamp(num(value.angle, DEFAULT_STYLE.angle), L.angle.min, L.angle.max),
    opacity: clamp(num(value.opacity, DEFAULT_STYLE.opacity), L.opacity.min, L.opacity.max),
    fontSize: clamp(num(value.fontSize, DEFAULT_STYLE.fontSize), L.fontSize.min, L.fontSize.max),
    color: typeof value.color === "string" && isHexColor(value.color) ? value.color : DEFAULT_STYLE.color,
    density: clamp(Math.round(num(value.density, DEFAULT_STYLE.density)), L.density.min, L.density.max),
  };
}

export function normalizeDpi(value: unknown): Dpi {
  for (const dpi of DPI_OPTIONS) if (dpi === value) return dpi;
  return 200;
}

export function sameStyle(a: WatermarkStyle, b: WatermarkStyle): boolean {
  return (
    a.text === b.text &&
    a.angle === b.angle &&
    a.opacity === b.opacity &&
    a.fontSize === b.fontSize &&
    a.color.toLowerCase() === b.color.toLowerCase() &&
    a.density === b.density
  );
}
