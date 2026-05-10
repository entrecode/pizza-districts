// /play — game surface skeleton (PIZ-16).
// MapShell wiring lands in PIZ-17. This page exists today so the perf-budget
// gate (Playwright transferSize + Lighthouse mobile ≥ 85) has a stable target.
//
// Auth note: this route is intentionally public in Phase 1 so the CI gate
// can hit it without a Supabase session fixture. When PIZ-17 wires MapShell
// it moves under app/(game)/ alongside dashboard, with a Playwright auth
// helper bootstrapped at the same time.

export const dynamic = "force-static";

export default function PlayPage() {
  return (
    <main className="relative flex min-h-dvh flex-col bg-surface text-text">
      <header className="flex items-center justify-between px-5 py-4">
        <p className="text-label uppercase tracking-wide text-text-muted">Pizza Districts</p>
        <span className="rounded-pill bg-surface-muted px-3 py-1 text-caption text-text-muted">
          Phase 1
        </span>
      </header>

      <section
        aria-label="Map surface"
        className="relative mx-5 flex-1 overflow-hidden rounded-card border border-border bg-surface-muted"
      >
        <div className="absolute inset-0 grid place-items-center text-center">
          <div className="max-w-[18rem] px-6">
            <p className="font-display text-h2">Map surface</p>
            <p className="mt-2 text-body text-text-muted">
              MapShell, custom mapId, and AdvancedMarker clustering land in the next PR.
            </p>
          </div>
        </div>
      </section>

      <footer className="grid grid-cols-3 gap-2 px-5 py-4">
        <button
          type="button"
          className="rounded-button bg-surface-muted px-3 py-2 text-label text-text-muted"
          disabled
        >
          Districts
        </button>
        <button
          type="button"
          className="rounded-button bg-brand-primary px-3 py-2 text-label text-brand-primary-ink"
          disabled
        >
          Locations
        </button>
        <button
          type="button"
          className="rounded-button bg-surface-muted px-3 py-2 text-label text-text-muted"
          disabled
        >
          Finance
        </button>
      </footer>
    </main>
  );
}
