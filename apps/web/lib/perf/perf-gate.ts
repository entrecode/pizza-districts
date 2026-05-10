import "server-only";

/**
 * Unauthenticated access to `(player)` routes and parcel snapshot API for perf tests.
 *
 * Enabled only when `PERF_GATE=1` on non-Vercel hosts (local `next start`, GitHub Actions).
 * Vercel preview/prod always uses real Supabase sessions — use Playwright storageState or manual runs.
 */
export function perfAuthBypassEnabled(): boolean {
  if (process.env.PERF_GATE !== "1") {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.VERCEL === "1") {
    return false;
  }
  return true;
}
