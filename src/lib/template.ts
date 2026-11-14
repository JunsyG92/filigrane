import type { WatermarkVariables } from "./types.ts";

export const TEMPLATE_VARIABLES = ["date", "destinataire", "objet"] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

const PLACEHOLDER = /\{\s*(date|destinataire|objet)\s*\}/gi;
const EMPTY_VALUE = "…";

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 2026-09-14 → 14/09/2026. Toute autre valeur est renvoyée telle quelle. */
export function formatFrenchDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso.trim();
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function toVariable(name: string): TemplateVariable | null {
  const lower = name.toLowerCase();
  for (const v of TEMPLATE_VARIABLES) if (v === lower) return v;
  return null;
}

function valueOf(variable: TemplateVariable, vars: WatermarkVariables): string {
  switch (variable) {
    case "date":
      return formatFrenchDate(vars.date);
    case "destinataire":
      return vars.destinataire.trim();
    case "objet":
      return vars.objet.trim();
  }
}

export function resolveTemplate(text: string, vars: WatermarkVariables): string {
  return text.replace(PLACEHOLDER, (whole: string, name: string) => {
    const variable = toVariable(name);
    if (!variable) return whole;
    return valueOf(variable, vars) || EMPTY_VALUE;
  });
}

/** Lignes finales du filigrane (variables remplacées, lignes vides retirées). */
export function watermarkLines(text: string, vars: WatermarkVariables): string[] {
  return resolveTemplate(text, vars)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

/** Variables présentes dans le texte mais sans valeur renseignée. */
export function missingVariables(text: string, vars: WatermarkVariables): TemplateVariable[] {
  const missing = new Set<TemplateVariable>();
  for (const match of text.matchAll(PLACEHOLDER)) {
    const variable = toVariable(match[1]);
    if (variable && !valueOf(variable, vars)) missing.add(variable);
  }
  return [...missing];
}
