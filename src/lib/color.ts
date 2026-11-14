export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** #rrggbb → composantes entre 0 et 1 (noir si la valeur est invalide). */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  if (!isHexColor(hex)) return { r: 0, g: 0, b: 0 };
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
