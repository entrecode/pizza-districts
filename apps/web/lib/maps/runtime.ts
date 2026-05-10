/**
 * Maps bootstrap is skipped in CI and local shells without real cloud map IDs so
 * perf gates stay deterministic (see [PIZ-16](/PIZ/issues/PIZ-16)).
 */
export function mapsRuntimeEnabled(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID;
  if (!key || key.length < 8) return false;
  if (key === "ci-placeholder") return false;
  if (!mapId || mapId.length < 2) return false;
  if (mapId === "ci-placeholder") return false;
  return true;
}
