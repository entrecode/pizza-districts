// Single source of truth for the /play mobile performance budgets.
// Numbers come from ADR-0004 §1 (PIZ-7). The 10% slack is the CI fail
// threshold defined in PIZ-16 acceptance — anything beyond that fails the
// build, anything inside it passes (loudly when it crosses the budget).

export const KB = 1024;

export const PERF_BUDGETS = {
  // /play initial JS payload, gzipped, EXCLUDING anything served from
  // *.googleapis.com / *.gstatic.com (Maps loader and library code).
  ownJsGzKB: 180,

  // Total Maps JS payload, gzipped: js-api-loader + core + marker libs.
  // Counted as everything served from *.googleapis.com or maps.gstatic.com
  // that has a JS-ish content-type.
  mapsJsGzKB: 280,

  // Time from navigationStart to the first paint event observed AFTER
  // a Google Maps script has been requested. Not measured (and not
  // asserted) on pages that never request Maps — Phase 1 baseline runs
  // pre-MapShell and will skip this.
  firstMapPaintMs: 2500,

  // Lighthouse mobile performance score floor for /play.
  lighthouseMobile: 0.85,
} as const;

// 10 % slack: CI fails if measurement > budget * (1 + slack).
export const FAIL_SLACK = 0.1;

export const ceilingOf = (budget: number) => budget * (1 + FAIL_SLACK);

// Hosts whose responses count toward the Maps JS payload, NOT the route's
// own JS payload. Anything from these counts as "Maps".
export const MAPS_HOSTS = [
  /^maps\.googleapis\.com$/i,
  /^maps\.gstatic\.com$/i,
  /^.*\.googleapis\.com$/i,
];

export function isMapsHost(host: string): boolean {
  return MAPS_HOSTS.some((re) => re.test(host));
}
