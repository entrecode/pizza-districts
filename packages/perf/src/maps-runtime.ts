/**
 * Mirrors production MapShell gating: real Maps runtime only when both
 * NEXT_PUBLIC_* values are present and not CI placeholders.
 */
export function mapsRuntimeEnabled(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID ?? "";
  if (!key || !mapId) {
    return false;
  }
  if (key === "ci-placeholder" || mapId === "ci-placeholder") {
    return false;
  }
  return true;
}

/** Budgets from PIZ-73 — do not widen without CEO/ADR. */
export const MAPS_JS_BUDGET_BYTES_GZ = 280 * 1024;
export const FIRST_MAP_PAINT_BUDGET_MS = 2500;
export const BUDGET_TOLERANCE = 1.1;
