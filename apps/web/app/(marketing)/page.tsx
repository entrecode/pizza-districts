export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-surface text-text">
      <section className="mx-auto flex max-w-md flex-col gap-4 px-5 py-10">
        <p className="text-label uppercase tracking-wide text-text-muted">Pizza Districts</p>
        <h1 className="font-display text-h1">Phase 1 bootstrap online.</h1>
        <p className="text-body text-text-muted">
          Mobile-first tycoon scaffold. Routes live under{" "}
          <code className="font-mono text-mono-sm">app/(marketing)</code>,{" "}
          <code className="font-mono text-mono-sm">app/(game)</code>, and{" "}
          <code className="font-mono text-mono-sm">app/(admin)</code> per ADR-0001.
        </p>
      </section>
    </main>
  );
}
