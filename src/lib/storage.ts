import { normalizeDpi, normalizeStyle } from "./presets.ts";
import type { Dpi, WatermarkStyle } from "./types.ts";

/**
 * Seuls les RÉGLAGES du modèle personnalisé sont stockés (localStorage, ce navigateur uniquement).
 * Jamais le contenu des documents, ni les valeurs des variables, ni le mot de passe.
 */
const KEY = "filigrane:modele-personnalise:v1";

export interface CustomPreset {
  style: WatermarkStyle;
  flatten: boolean;
  dpi: Dpi;
}

export function loadCustomPreset(): CustomPreset | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const style = normalizeStyle(record.style);
    if (!style) return null;
    return { style, flatten: record.flatten !== false, dpi: normalizeDpi(record.dpi) };
  } catch {
    return null;
  }
}

export function saveCustomPreset(preset: CustomPreset): boolean {
  try {
    const payload: CustomPreset = { style: preset.style, flatten: preset.flatten, dpi: preset.dpi };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function deleteCustomPreset(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible (navigation privée) : rien à supprimer
  }
}
