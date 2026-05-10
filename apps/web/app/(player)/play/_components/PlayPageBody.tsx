"use client";

import { lazy, Suspense } from "react";

import { usePlayStore } from "@/lib/store/play-store";

const MapShell = lazy(async () => import("./MapShell"));

function MapTileFallback() {
  return (
    <div
      className="absolute inset-0 animate-pulse bg-surface-muted"
      aria-busy="true"
      aria-label="Loading map module"
    />
  );
}

export function PlayPageBody() {
  const selectedParcelId = usePlayStore((s) => s.selectedParcelId);

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
        className="relative mx-5 min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-surface-muted"
      >
        {/* Fill flex-1 slot: h-full inside a plain flex child is unreliable cross-browser; pin map layer to section box */}
        <div className="absolute inset-0">
          <Suspense fallback={<MapTileFallback />}>
            <MapShell />
          </Suspense>
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

      {selectedParcelId ? (
        <p className="sr-only" aria-live="polite">
          Selected parcel {selectedParcelId}
        </p>
      ) : null}
    </main>
  );
}
